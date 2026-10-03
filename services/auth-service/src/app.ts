import { Hono } from "hono";
import { cors } from "hono/cors";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { generateCodeVerifier, generateState } from "arctic";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { createDatabaseClient } from "@resume-forge/prisma-client";
import type { GoogleProvider } from "./google.js";
import { createActorRoute } from "./actor-route.js";

type Database = ReturnType<typeof createDatabaseClient>;
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const cookie = {
  path: "/api/v1/auth",
  httpOnly: true,
  sameSite: "Lax" as const,
  secure: false,
};
const lifetime = 30 * 24 * 60 * 60;

/** Single-process local implementation. Restart invalidates pending OAuth and access tokens. */
export function createAuthApp({
  db,
  provider,
  appOrigin,
  profileServiceKey,
  now = Date.now,
}: {
  db: Database;
  provider?: GoogleProvider;
  appOrigin: string;
  profileServiceKey?: string;
  now?: () => number;
}) {
  const app = new Hono();
  const pending = new Map<
    string,
    { verifier: string; binding: string; expires: number }
  >();
  const access = new Map<string, { sessionId: string; expires: number }>();
  const activeGrant = (token: string | undefined) => {
    const grant = token ? access.get(hash(token)) : undefined;
    return grant && grant.expires > now() ? grant : undefined;
  };
  app.use(
    "/api/v1/auth/*",
    cors({
      origin: appOrigin,
      credentials: true,
      allowHeaders: ["Authorization", "Content-Type"],
    }),
  );
  app.use("*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    c.header("Referrer-Policy", "no-referrer");
    for (const [key, value] of pending)
      if (value.expires <= now()) pending.delete(key);
    for (const [key, value] of access)
      if (value.expires <= now()) access.delete(key);
    if (
      c.req.path.startsWith("/api/v1/auth/") &&
      c.req.method === "POST" &&
      c.req.header("Origin") !== appOrigin
    )
      return c.json({ error: "Untrusted origin" }, 403);
    await next();
  });
  app.onError(
    () =>
      new Response(
        JSON.stringify({
          error: "Sign-in is temporarily unavailable. Try again.",
        }),
        {
          status: 503,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        },
      ),
  );
  const failure = (reason: string) =>
    `${appOrigin}/sign-in?auth_error=${reason}`;
  app.route(
    "/",
    createActorRoute({
      key: profileServiceKey,
      resolve: async (token) => {
        const grant = activeGrant(token);
        if (!grant) return null;
        // Identity projection only: no login email/name, provider, professional or contact content.
        const session = await db.session.findUnique({
          where: { id: grant.sessionId },
          select: {
            userId: true,
            revokedAt: true,
            expiresAt: true,
            user: {
              select: {
                personalWorkspace: {
                  select: { id: true, type: true, personalOwnerUserId: true },
                },
              },
            },
          },
        });
        const workspace = session?.user.personalWorkspace;
        const expiresAt = Math.min(
          grant.expires,
          session?.expiresAt.getTime() ?? 0,
        );
        if (
          !session ||
          session.revokedAt ||
          expiresAt <= now() ||
          !workspace ||
          workspace.type !== "individual" ||
          workspace.personalOwnerUserId !== session.userId
        )
          return null;
        return {
          userId: session.userId,
          personalWorkspaceId: workspace.id,
          expiresAt,
        };
      },
    }),
  );
  app.get("/api/v1/auth/google/url", (c) => {
    if (!provider)
      return c.json(
        {
          error:
            "Google sign-in is not configured. Restart after setting the server environment.",
        },
        503,
      );
    if (pending.size >= 1000)
      return c.json({ error: "Sign-in is busy. Try again shortly." }, 429);
    const state = generateState();
    const verifier = generateCodeVerifier();
    const binding = randomBytes(32).toString("hex");
    pending.set(state, {
      verifier,
      binding: hash(binding),
      expires: now() + 600000,
    });
    setCookie(c, "oauth_binding", binding, { ...cookie, maxAge: 600 });
    return c.json({ url: provider.authorizationURL(state, verifier) });
  });
  app.get("/api/v1/auth/google/callback", async (c) => {
    const state = c.req.query("state") ?? "";
    const transaction = pending.get(state);
    const binding = getCookie(c, "oauth_binding");
    if (!transaction || !binding || hash(binding) !== transaction.binding)
      return c.redirect(failure("invalid_callback"));
    pending.delete(state);
    deleteCookie(c, "oauth_binding", cookie);
    if (c.req.query("error")) return c.redirect(failure("cancelled"));
    const code = c.req.query("code");
    if (!provider || !code || code.length > 4096)
      return c.redirect(failure("invalid_callback"));
    try {
      const identity = await provider.identity(code, transaction.verifier);
      const rawRefresh = randomBytes(32).toString("hex");
      await db.$transaction(async (tx) => {
        const account = await tx.oAuthAccount.findUnique({
          where: {
            provider_providerSubject: {
              provider: "google",
              providerSubject: identity.sub,
            },
          },
        });
        let userId = account?.userId;
        if (!userId) {
          if (await tx.user.findUnique({ where: { email: identity.email } }))
            throw new Error("ACCOUNT_LINK_REQUIRED");
          const user = await tx.user.create({
            data: {
              email: identity.email,
              name: identity.name,
              accounts: {
                create: { provider: "google", providerSubject: identity.sub },
              },
              personalWorkspace: { create: { type: "individual" } },
            },
          });
          userId = user.id;
        }
        await tx.session.create({
          data: {
            userId,
            familyId: randomUUID(),
            refreshHash: hash(rawRefresh),
            expiresAt: new Date(now() + lifetime * 1000),
          },
        });
      });
      setCookie(c, "refresh_token", rawRefresh, {
        ...cookie,
        maxAge: lifetime,
      });
      return c.redirect(`${appOrigin}/sign-in?signed_in=1`);
    } catch (error) {
      return c.redirect(
        failure(
          error instanceof Error && error.message === "ACCOUNT_LINK_REQUIRED"
            ? "account_link_required"
            : "provider_failed",
        ),
      );
    }
  });
  app.post("/api/v1/auth/refresh", async (c) => {
    const credential = getCookie(c, "refresh_token");
    if (!credential || credential.length > 128)
      return c.json({ error: "Unauthorized" }, 401);
    const raw = randomBytes(32).toString("hex");
    const rotated = await db.$transaction(async (tx) => {
      const current = await tx.session.findUnique({
        where: { refreshHash: hash(credential) },
      });
      if (!current) return null;
      if (current.revokedAt || current.expiresAt.getTime() <= now()) {
        await tx.session.updateMany({
          where: { familyId: current.familyId, revokedAt: null },
          data: { revokedAt: new Date(now()) },
        });
        return null;
      }
      const claimed = await tx.session.updateMany({
        where: { id: current.id, revokedAt: null },
        data: { revokedAt: new Date(now()) },
      });
      if (!claimed.count) {
        await tx.session.updateMany({
          where: { familyId: current.familyId, revokedAt: null },
          data: { revokedAt: new Date(now()) },
        });
        return null;
      }
      const replacement = await tx.session.create({
        data: {
          userId: current.userId,
          familyId: current.familyId,
          refreshHash: hash(raw),
          expiresAt: current.expiresAt,
        },
      });
      await tx.session.update({
        where: { id: current.id },
        data: { replacedById: replacement.id },
      });
      return replacement;
    });
    if (!rotated) {
      deleteCookie(c, "refresh_token", cookie);
      return c.json({ error: "Unauthorized" }, 401);
    }
    const token = randomBytes(32).toString("hex");
    access.set(hash(token), { sessionId: rotated.id, expires: now() + 300000 });
    setCookie(c, "refresh_token", raw, {
      ...cookie,
      maxAge: Math.max(
        0,
        Math.floor((rotated.expiresAt.getTime() - now()) / 1000),
      ),
    });
    return c.json({ data: { accessToken: token, expiresIn: 300 } });
  });
  app.get("/api/v1/auth/me", async (c) => {
    const bearer = c.req
      .header("Authorization")
      ?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    const grant = activeGrant(bearer);
    if (!grant) return c.json({ error: "Unauthorized" }, 401);
    const session = await db.session.findUnique({
      where: { id: grant.sessionId },
      include: {
        user: {
          include: {
            personalWorkspace: true,
            profile: { select: { onboardingCompletedAt: true } },
          },
        },
      },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() <= now() ||
      grant.expires <= now()
    )
      return c.json({ error: "Unauthorized" }, 401);
    return c.json({
      data: {
        id: session.userId,
        name: session.user.name,
        workspaceId: session.user.personalWorkspace?.id,
        isOnboarded: Boolean(session.user.profile?.onboardingCompletedAt),
      },
    });
  });
  app.post("/api/v1/auth/logout", async (c) => {
    const credential = getCookie(c, "refresh_token");
    if (credential && credential.length <= 128) {
      const current = await db.session.findUnique({
        where: { refreshHash: hash(credential) },
      });
      if (current)
        await db.session.updateMany({
          where: { familyId: current.familyId },
          data: { revokedAt: new Date(now()) },
        });
    }
    deleteCookie(c, "refresh_token", cookie);
    return c.json({ data: { success: true } });
  });
  return app;
}

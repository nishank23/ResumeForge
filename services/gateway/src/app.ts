import { Hono, type Context } from "hono";
import { cors } from "hono/cors";

/** Local personal-profile transport. Domain authorization stays in profile-service. */
export function createGatewayApp(request: typeof fetch = fetch) {
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    c.header("Referrer-Policy", "no-referrer");
    await next();
  });
  app.use(
    "/api/v1/*",
    cors({
      origin: "http://localhost:3000",
      allowMethods: ["GET", "POST", "PUT", "DELETE"],
      allowHeaders: ["Authorization", "Content-Type", "X-Workspace-Id"],
      exposeHeaders: [
        "X-Request-Id",
        "X-Resume-Version",
        "Content-Disposition",
      ],
    }),
  );
  app.get("/api/v1/health", (c) =>
    c.json({
      data: {
        status: "ok",
        timestamp: new Date().toISOString(),
      },
    }),
  );
  app.on(["GET", "POST", "PUT"], "/api/v1/profile", proxy);
  app.put("/api/v1/profile/draft", proxy);
  app.on(["GET", "POST"], "/api/v1/resume", proxy);
  app.post("/api/v1/resume/parse", proxy);
  app.on(["GET", "PUT", "DELETE"], "/api/v1/resume/:id", proxy);
  app.post("/api/v1/resume/:id/restore", proxy);
  app.get("/api/v1/resume/:id/pdf", proxy);
  app.on(["GET", "POST"], "/api/v1/resume/:id/readiness", proxy);
  app.put("/api/v1/resume/:id/readiness/preferences", proxy);
  app.on(["GET", "POST"], "/api/v1/resume/:id/jd-match", proxy);
  app.put("/api/v1/resume/:id/jd-match/preferences", proxy);
  app.post("/api/v1/resume/:id/ai-rewrite", proxy);
  app.post("/api/v1/resume/:id/ai-rewrite/apply", proxy);
  app.on(["GET", "POST"], "/api/v1/resume/:id/tailoring", proxy);
  app.post("/api/v1/resume/:id/tailoring/cancel", proxy);
  app.post("/api/v1/resume/:id/tailoring/apply", proxy);
  async function proxy(c: Context) {
    const origin = c.req.header("Origin");
    if (origin && origin !== "http://localhost:3000")
      return c.json(
        { error: { code: "forbidden", message: "Origin unavailable." } },
        403,
      );
    const headers = new Headers();
    for (const name of [
      "Authorization",
      "Content-Type",
      "X-Workspace-Id",
      "Origin",
    ]) {
      const value = c.req.header(name);
      if (value) headers.set(name, value);
    }
    try {
      // Stream the bounded service input; do not buffer or log private bodies.
      const upstream = await request(
        `http://127.0.0.1:${c.req.path.startsWith("/api/v1/resume") ? "4003" : "4002"}${c.req.path}${new URL(c.req.url).search}`,
        {
          method: c.req.method,
          headers,
          ...(c.req.method === "GET"
            ? {}
            : { body: c.req.raw.body, duplex: "half" }),
          redirect: "manual",
          signal: AbortSignal.timeout(
            c.req.path.endsWith("/pdf")
              ? 30_000
              : c.req.path.endsWith("/jd-match") ||
                  c.req.path.endsWith("/ai-rewrite")
                ? 60_000
                : 10_000,
          ),
        },
      );
      const responseHeaders = new Headers({
        "Content-Type":
          c.req.path.endsWith("/pdf") && upstream.ok
            ? "application/pdf"
            : "application/json",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      });
      if (c.req.path.endsWith("/pdf") && upstream.ok) {
        for (const name of [
          "Content-Disposition",
          "X-Resume-Version",
          "X-Content-Type-Options",
        ]) {
          const value = upstream.headers.get(name);
          if (value) responseHeaders.set(name, value);
        }
      }
      const requestId = upstream.headers.get("X-Request-Id");
      if (requestId) responseHeaders.set("X-Request-Id", requestId);
      return new Response(upstream.body, {
        status: upstream.status,
        headers: responseHeaders,
      });
    } catch {
      return c.json(
        {
          error: {
            code: c.req.path.startsWith("/api/v1/resume")
              ? "resume_unavailable"
              : "profile_unavailable",
            message: "Service is temporarily unavailable.",
          },
        },
        503,
      );
    }
  }
  app.notFound((c) =>
    c.json({ error: { code: "NOT_FOUND", message: "Route not found" } }, 404),
  );
  return app;
}

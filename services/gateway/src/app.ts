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
      allowMethods: ["GET", "POST", "PUT"],
      allowHeaders: ["Authorization", "Content-Type", "X-Workspace-Id"],
      exposeHeaders: ["X-Request-Id"],
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
  app.on(["GET", "PUT"], "/api/v1/resume/:id", proxy);
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
          signal: AbortSignal.timeout(10_000),
        },
      );
      const responseHeaders = new Headers({
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      });
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
            code: c.req.path.startsWith("/api/v1/resume") ? "resume_unavailable" : "profile_unavailable",
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

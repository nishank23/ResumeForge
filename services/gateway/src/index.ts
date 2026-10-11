import { serve } from "@hono/node-server";
import { createGatewayApp } from "./app.js";

if (process.env.NODE_ENV === "production")
  throw new Error("Local profile gateway is not approved for production.");
const app = createGatewayApp();
const port = Number(process.env.GATEWAY_PORT ?? 4000);
serve(
  {
    fetch: app.fetch,
    hostname:
      process.env.RESUME_FORGE_RUNTIME === "docker" ? "0.0.0.0" : "127.0.0.1",
    port,
  },
  () => {
    console.log(`Gateway listening on http://localhost:${String(port)}`);
  },
);
export default app;

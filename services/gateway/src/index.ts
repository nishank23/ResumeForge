import { serve } from "@hono/node-server";
import { createGatewayApp } from "./app.js";
import { runtimeAppOrigin } from "@resume-forge/access-policy/server";

const app = createGatewayApp(fetch, runtimeAppOrigin());
const port = Number(process.env.GATEWAY_PORT ?? 4000);
serve(
  {
    fetch: app.fetch,
    hostname: ["docker", "cloud"].includes(
      process.env.RESUME_FORGE_RUNTIME ?? "",
    )
      ? "0.0.0.0"
      : "127.0.0.1",
    port,
  },
  () => {
    console.log(`Gateway listening on http://localhost:${String(port)}`);
  },
);
export default app;

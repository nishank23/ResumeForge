import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
export async function serveResumeUx() {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const server = await createServer({
    root,
    configFile: false,
    // Keep synthetic React optimization separate from live federation owner modules.
    cacheDir: resolve(root, "node_modules/.vite-resume-ux"),
    plugins: [
      react(),
      {
        name: "synthetic-resume-ux-fixture",
        configureServer(vite) {
          vite.middlewares.use(async (req, res, next) => {
            if (!req.url?.startsWith("/__resume-ux")) return next();
            try {
              const html = await vite.transformIndexHtml(
                req.url,
                '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Resume UX component checks</title></head><body><p style="margin:0;padding:8px 16px;font:13px Arial;background:#302638;color:#f8f6fd">Local component preview. Synthetic data; no production writes or AI calls.</p><div id="root"></div><script type="module" src="/test/ui/ResumeUxHarness.jsx"></script></body></html>',
              );
              res.setHeader("Content-Type", "text/html");
              res.end(html);
            } catch (e) {
              next(e);
            }
          });
        },
      },
    ],
    resolve: {
      dedupe: ["react", "react-dom"],
      alias: [
        {
          find: /^@resume-forge\/shared$/,
          replacement: resolve(root, "test/ui/shared-harness.js"),
        },
      ],
    },
    server: {
      host: "127.0.0.1",
      port: 0,
      fs: {
        allow: [resolve(root, "../..")],
        deny: [
          "**/.env",
          "**/.env.*",
          "**/.local/**",
          "**/.git/**",
          "**/check_resumes/**",
          "**/*.pem",
          "**/*.key",
        ],
      },
    },
    optimizeDeps: { include: ["react", "react-dom/client", "lucide-react"] },
  });
  await server.listen();
  const port = server.httpServer.address().port;
  return { server, url: `http://127.0.0.1:${port}/__resume-ux` };
}
if (process.argv.includes("--serve-only")) {
  const { url } = await serveResumeUx();
  console.log("RESUME_UX_CHECK_URL=" + url);
}

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { federation } from "@module-federation/vite";

export default defineConfig({
  base: process.env.FORGE_PUBLIC_ORIGIN ? "/mfe/resume/" : "/",
  define: { __FORGE_CLOUD__: Boolean(process.env.FORGE_PUBLIC_ORIGIN) },
  plugins: [
    react(),
    tailwindcss(),
    federation({
      name: "resume_mfe",
      filename: "remoteEntry.js",
      dts: false,
      shareStrategy: "loaded-first",
      hostInitInjectLocation: "entry",
      exposes: {
        "./ResumeRemoteRoot": "./src/ResumeRemoteRoot.tsx",
      },
      shared: {
        react: { singleton: true },
        "react-dom": { singleton: true },
        "react-router": { singleton: true },
        "@resume-forge/shared": { singleton: true },
      },
    }),
  ],
  optimizeDeps: {
    include: ["lucide-react", "@resume-forge/shared > performative-ui"],
  },
  build: {
    target: "chrome89",
  },
  server: {
    port: 3003,
    strictPort: true,
    cors: true,
  },
  preview: {
    port: 3003,
    strictPort: true,
    cors: true,
  },
});

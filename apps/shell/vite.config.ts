import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { federation } from "@module-federation/vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    federation({
      name: "shell",
      filename: "remoteEntry.js",
      dts: false,
      shareStrategy: "loaded-first",
      hostInitInjectLocation: "entry",
      remotes: {
        auth_mfe: {
          type: "module",
          name: "auth_mfe",
          entry: "http://localhost:3001/remoteEntry.js",
        },
        profile_mfe: {
          type: "module",
          name: "profile_mfe",
          entry: "http://localhost:3002/remoteEntry.js",
        },
        resume_mfe: {
          type: "module",
          name: "resume_mfe",
          entry: "http://localhost:3003/remoteEntry.js",
        },
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
  server: {
    port: 3000,
    strictPort: true,
    cors: true,
  },
  preview: {
    port: 3000,
    strictPort: true,
    cors: true,
  },
  build: {
    target: "chrome89",
  },
});

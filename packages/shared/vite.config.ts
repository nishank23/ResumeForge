import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import dts from "vite-plugin-dts";
import { resolve } from "node:path";

export default defineConfig({
  define: { __FORGE_CLOUD__: Boolean(process.env.FORGE_PUBLIC_ORIGIN) },
  plugins: [
    react(),
    tailwindcss(),
    dts({ rollupTypes: true, bundledPackages: ["@resume-forge/shared-types"] }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es"],
      fileName: "index",
      cssFileName: "styles",
    },
    rollupOptions: {
      external: [
        /^@tiptap\//,
        "react",
        "react-dom",
        "react/jsx-runtime",
        "lucide-react",
        "performative-ui",
        "@resume-forge/shared-types",
      ],
    },
  },
});

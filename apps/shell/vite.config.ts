import { defineConfig, type HtmlTagDescriptor, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { federation } from "@module-federation/vite";

// Federation discovers its core shares through several dynamic imports. Fetch
// those files together without evaluating them early or loading lazy remotes.
function preloadShellBootstrap(): Plugin {
  let base = "/";
  return {
    name: "forge-preload-shell-bootstrap",
    apply: "build",
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: {
      order: "post",
      handler(html, context) {
        if (!context.bundle || !context.chunk) return;
        const tags: HtmlTagDescriptor[] = [];
        const visited = new Set<string>();
        const visit = (fileName: string) => {
          if (
            visited.has(fileName) ||
            /loadRemote__|ssrEntryLoader-/.test(fileName)
          )
            return;
          visited.add(fileName);
          const chunk = context.bundle?.[fileName];
          if (chunk?.type !== "chunk") return;
          const href = `${base}${fileName}`;
          if (!html.includes(`href="${href}"`)) {
            tags.push({
              tag: "link",
              attrs: { rel: "modulepreload", crossorigin: "", href },
              injectTo: "head",
            });
          }
          for (const dependency of chunk.imports) visit(dependency);
          // Application features (for example Tiptap) stay lazy. Only follow
          // federation's bootstrap and share-loader dynamic imports.
          if (
            fileName === context.chunk?.fileName ||
            /hostInit-|pendingShares-|localSharedImportMap|loadShare__|remoteEntry\.js$/.test(
              fileName,
            )
          ) {
            for (const dependency of chunk.dynamicImports) visit(dependency);
          }
        };
        visit(context.chunk.fileName);
        return tags;
      },
    },
  };
}

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
    preloadShellBootstrap(),
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

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const isBuild = process.argv.includes("build");
const isReplit = !!process.env.REPL_ID;

const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : 3000;
const basePath = process.env.BASE_PATH ?? "/";

if (!isBuild && !isReplit && (!rawPort || Number.isNaN(port) || port <= 0)) {
  throw new Error("PORT environment variable is required.");
}

export default defineConfig(async () => {
  const plugins: any[] = [react(), tailwindcss()];

  if (isReplit) {
    try {
      const { default: runtimeErrorOverlay } = await import("@replit/vite-plugin-runtime-error-modal");
      plugins.push(runtimeErrorOverlay());
    } catch {}
    if (!isBuild) {
      try {
        const { cartographer } = await import("@replit/vite-plugin-cartographer");
        plugins.push(cartographer({ root: path.resolve(import.meta.dirname, "..") }));
      } catch {}
      try {
        const { devBanner } = await import("@replit/vite-plugin-dev-banner");
        plugins.push(devBanner());
      } catch {}
    }
  }

  return {
    base: basePath,
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      port: isReplit ? port : 3000,
      host: "0.0.0.0",
      allowedHosts: true,
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
    preview: {
      port: 3000,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});

import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: resolve(import.meta.dirname),
  define: {
    __BUILD_ID__: JSON.stringify(process.env.GITHUB_SHA?.slice(0, 7) ?? "source"),
  },
  build: {
    outDir: resolve(import.meta.dirname, "../dist/site"),
    emptyOutDir: true,
    target: "es2022",
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        demo: resolve(import.meta.dirname, "demo/index.html"),
        privacy: resolve(import.meta.dirname, "privacy/index.html"),
        terms: resolve(import.meta.dirname, "terms/index.html"),
        notFound: resolve(import.meta.dirname, "404.html"),
      },
    },
  },
  test: {
    include: [resolve(import.meta.dirname, "src/**/*.test.ts")],
    environment: "node",
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});

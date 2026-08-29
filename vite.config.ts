import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const apiOrigin = process.env.VITE_DEV_API_ORIGIN ?? "http://127.0.0.1:30010";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": { target: apiOrigin, changeOrigin: true },
      "/health": { target: apiOrigin, changeOrigin: true },
      "/bark-check": {
        target: "https://bark.mangguo.cloud",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bark-check/, "/check"),
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
  },
});

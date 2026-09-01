import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const apiOrigin = process.env.VITE_DEV_API_ORIGIN ?? "http://127.0.0.1:30010";
const bffOrigin = process.env.VITE_DEV_BFF_ORIGIN ?? "http://127.0.0.1:30012";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/auth": { target: bffOrigin, changeOrigin: true },
      "/api/devices": { target: bffOrigin, changeOrigin: true },
      "/api/settings": { target: bffOrigin, changeOrigin: true },
      "/api": { target: apiOrigin, changeOrigin: true },
      "/health": { target: apiOrigin, changeOrigin: true },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
  },
});

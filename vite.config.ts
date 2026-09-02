import { defineConfig, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";
import { rewriteLoopbackHost } from "./src/dev/rewriteLoopbackHost";

const apiOrigin = process.env.VITE_DEV_API_ORIGIN ?? "http://127.0.0.1:30010";
const bffOrigin = process.env.VITE_DEV_BFF_ORIGIN ?? "http://127.0.0.1:30012";

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function proxyTo(target: string): ProxyOptions {
  return {
    target,
    changeOrigin: true,
    configure(proxy) {
      proxy.on("proxyReq", (proxyReq, req) => {
        const origin = rewriteLoopbackHost(firstHeader(req.headers.origin));
        if (origin) {
          proxyReq.setHeader("origin", origin);
        }
        const referer = rewriteLoopbackHost(firstHeader(req.headers.referer));
        if (referer) {
          proxyReq.setHeader("referer", referer);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api/auth": proxyTo(bffOrigin),
      "/api/devices": proxyTo(bffOrigin),
      "/api/settings": proxyTo(bffOrigin),
      "/api": proxyTo(apiOrigin),
      "/health": proxyTo(apiOrigin),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
  },
});

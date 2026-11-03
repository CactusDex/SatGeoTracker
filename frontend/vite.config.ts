import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // satellite.js 7.x bundles WASM code with top-level await inside workers.
  // Vite defaults worker output to IIFE, which cannot contain top-level await.
  worker: {
    format: "es",
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: false,
      },
      "/health": {
        target: "http://127.0.0.1:8000",
        changeOrigin: false,
      },
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
});

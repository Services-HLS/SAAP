import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: "127.0.0.1",
    proxy: {
      "/assets": { target: "https://sports.ap.gov.in", changeOrigin: true, secure: true },
      "/api": { target: "http://127.0.0.1:8000", changeOrigin: true },
    },
  },
});

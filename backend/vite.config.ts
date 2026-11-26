import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const backendPort = process.env.PORT ?? "3000";

export default defineConfig({
  root: path.resolve(__dirname, "client"),
  plugins: [react(), tailwindcss()],
  build: {
    outDir: path.resolve(__dirname, "client/dist"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/actions": `http://localhost:${backendPort}`,
      "/upload": `http://localhost:${backendPort}`,
      "/uploads": `http://localhost:${backendPort}`,
      "/sitemap.xml": `http://localhost:${backendPort}`,
      "/robots.txt": `http://localhost:${backendPort}`,
      "/llms.txt": `http://localhost:${backendPort}`,
    },
  },
});

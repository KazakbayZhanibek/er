import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import path from "node:path";

const contentPath = new URL('./src/content/site.json', import.meta.url);
const siteContent = {
  name: 'kompas-site-content',
  configureServer(server) {
    server.middlewares.use('/content/site.json', (_request, response) => {
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.setHeader('Cache-Control', 'no-cache');
      response.end(readFileSync(contentPath));
    });
  },
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'content/site.json', source: readFileSync(contentPath, 'utf8') });
  },
};

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "127.0.0.1",
    fs: {
      deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.kompas-data/**', ...(process.env.KOMPAS_DATA_DIR ? [`${path.resolve(process.env.KOMPAS_DATA_DIR)}/**`] : [])],
    },
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react(), siteContent],
});

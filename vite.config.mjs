import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import publication from "./src/content/publication.json";

function pageMetadata() {
  const encode = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  return {
    name: "kompas-page-metadata",
    transformIndexHtml(html) {
      const { title, description } = publication.page;
      return html.replace("<!--kompas-page-title-->", () =>
        `<title>${encode(title)}</title>\n    <meta name="description" content="${encode(description)}" />`);
    },
  };
}

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
  plugins: [react(), pageMetadata()],
});

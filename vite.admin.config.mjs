import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export default defineConfig({
  root: fileURLToPath(new URL('./admin', import.meta.url)),
  base: '/admin/',
  server: {
    host: '127.0.0.1',
    fs: {
      deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.kompas-data/**', ...(process.env.KOMPAS_DATA_DIR ? [`${path.resolve(process.env.KOMPAS_DATA_DIR)}/**`] : [])],
    },
  },
  build: { outDir: fileURLToPath(new URL('./dist/admin', import.meta.url)), emptyOutDir: true },
  plugins: [react()],
});

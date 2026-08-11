import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3789',
        changeOrigin: true,
        timeout: 600000,
        proxyTimeout: 600000,
      },
      '/ws': {
        target: 'ws://localhost:3789',
        ws: true,
      },
    },
  },
});

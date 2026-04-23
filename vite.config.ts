import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    assetsDir: '.',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
  server: {
    port: 3030,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api/upi': {
        target: 'https://merchant.upigateway.com/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/upi/, ""),
      },
    },
  },
  preview: {
    port: 3030,
    strictPort: true,
    host: '0.0.0.0',
  }
});
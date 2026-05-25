import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
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
    // PhonePe API calls are server-side only (via /api/* Vercel functions).
    // No client-side proxy needed.
  },
  preview: {
    port: 3030,
    strictPort: true,
    host: '0.0.0.0',
  }
});
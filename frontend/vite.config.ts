import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Forward all /api/* requests to the backend during development.
      // This avoids CORS issues and mirrors the production Nginx proxy config.
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        withCredentials: true,
      },
    },
  },
  build: {
    // Sourcemaps in production help with debugging on the Pi without
    // exposing source to browsers (serve them from a private path if needed).
    sourcemap: false,
    // Chunk size warning threshold (default 500 kB) — globe.gl is large.
    // We'll address code-splitting in Phase 5.
    chunkSizeWarningLimit: 1000,
  },
});

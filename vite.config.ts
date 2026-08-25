import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://bitjita.com',
        changeOrigin: true,
        secure: true,
        headers: {
          'User-Agent': 'Bitcraft-XP-Calculator/1.0',
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
});

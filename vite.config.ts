import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json';

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://bitjita.com',
        changeOrigin: true,
        secure: true,
        headers: {
          'User-Agent': `Bitcraft-XP-Calculator/${pkg.version}`,
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
});

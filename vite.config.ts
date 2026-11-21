import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json';

function versionPlugin(): Plugin {
  const createPayload = () =>
    JSON.stringify(
      {
        version: pkg.version,
        buildTime: Date.now(),
        builtAt: new Date().toISOString(),
      },
      null,
      2
    );

  return {
    name: 'version-manifest-plugin',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: createPayload(),
      });
    },
    configureServer(server) {
      server.middlewares.use('/version.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.end(createPayload());
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), versionPlugin()],
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

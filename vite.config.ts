import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import pkg from './package.json';

function versionPlugin(): Plugin {
  return {
    name: 'version-manifest-plugin',
    buildStart() {
      const publicDir = path.resolve(__dirname, 'public');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      const versionData = {
        version: pkg.version,
        buildTime: Date.now(),
        builtAt: new Date().toISOString(),
      };
      fs.writeFileSync(
        path.resolve(publicDir, 'version.json'),
        JSON.stringify(versionData, null, 2)
      );
    },
    configureServer(server) {
      server.middlewares.use('/version.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.end(
          JSON.stringify({
            version: pkg.version,
            buildTime: Date.now(),
            builtAt: new Date().toISOString(),
          }, null, 2)
        );
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

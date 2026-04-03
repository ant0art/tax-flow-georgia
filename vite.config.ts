import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Injects VITE_RSGE_WORKER_URL into the CSP meta tag at build time.
 * Reads from VITE_ env vars (via loadEnv) so that:
 *   - Locally: value comes from .env
 *   - CI/CD:   value comes from GitHub secrets (process.env)
 *
 * No hardcoded URLs in index.html.
 */
function cspWorkerPlugin(): Plugin {
  let workerOrigin = '';

  return {
    name: 'csp-worker-url',
    configResolved(config) {
      // loadEnv merges .env files + process.env
      const env = loadEnv(config.mode, config.root, 'VITE_');
      const url = env.VITE_RSGE_WORKER_URL || '';
      if (url) {
        try {
          workerOrigin = new URL(url).origin;
        } catch {
          // ignore invalid URL
        }
      }
    },
    transformIndexHtml(html) {
      if (!workerOrigin) return html;
      // Append worker origin to connect-src in the CSP meta tag
      return html.replace(
        /connect-src\s+'self'/,
        `connect-src 'self' ${workerOrigin}`
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), cspWorkerPlugin()],
  base: '/tax-flow-georgia/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('react-dom') || id.includes('react-router-dom') || id.includes('/react/')) {
            return 'react-vendor';
          }
          if (id.includes('react-hook-form') || id.includes('zod') || id.includes('@hookform')) {
            return 'forms';
          }
          if (id.includes('@tanstack/react-query')) {
            return 'query';
          }
        },
      },
    },
  },
})

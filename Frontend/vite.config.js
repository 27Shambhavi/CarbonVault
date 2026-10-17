import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

let rawCommit = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || '';
if (!rawCommit) {
  try {
    rawCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    rawCommit = '';
  }
}
const shortCommit = (rawCommit && rawCommit !== 'HEAD') ? rawCommit.slice(0, 7) : 'unknown';
const fullCommit = (rawCommit && rawCommit !== 'HEAD') ? rawCommit : 'unknown';

export default defineConfig({
  define: {
    __APP_COMMIT__: JSON.stringify(shortCommit),
    __APP_COMMIT_FULL__: JSON.stringify(fullCommit),
  },
  plugins: [react()],
  server: {
    proxy: {
      '/uploads': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/api/uploads': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 1200,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/__tests__/setup.js',
    include: ['src/__tests__/**/*.{test,spec}.{js,jsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
})

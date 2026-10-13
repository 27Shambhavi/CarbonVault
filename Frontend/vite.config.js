import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
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

import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '~': new URL('./src', import.meta.url).pathname,
    },
  },
  server: {
    proxy: {
      '/rpc': { target: 'http://localhost:3001', changeOrigin: true },
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/health': { target: 'http://localhost:3001', changeOrigin: true },
      '/_ws': { target: 'ws://localhost:3001', ws: true },
    },
  },
})

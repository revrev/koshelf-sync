import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiProxyTarget = process.env.KOSHELF_API_PROXY ?? 'http://localhost:17200'
const basePath = '/'

export default defineConfig({
  base: basePath,
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/admin': {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: false,
      },
      '/users': {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: false,
      },
      '/syncs': {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: false,
      },
      '/healthcheck': {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
})

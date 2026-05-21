import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import sitemap from 'vite-plugin-sitemap'

export default defineConfig({
  base: '/', // ✅ IMPORTANT for Hostinger / shared hosting

  plugins: [
    react(),
    sitemap({
      hostname: 'https://www.panuri.online'
    })
  ],

  optimizeDeps: {
    include: ['mammoth'],
  },

  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
      'Cross-Origin-Opener-Policy': 'same-origin',
    }
  }
})
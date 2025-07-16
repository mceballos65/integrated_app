import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      // Exclude directories that shouldn't be watched
      ignored: [
        '**/venv/**',
        '**/node_modules/**',
        '**/dist/**',
        '**/.git/**',
        '**/app_data/**',
        '**/*.log',
        '**/__pycache__/**',
        '**/*.pyc'
      ]
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  }
})

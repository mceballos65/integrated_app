import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/', 
  plugins: [react()],
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV !== 'production',
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
  publicDir: 'public',
  // Copy app_data directory to build for serving config files
  assetsInclude: ['**/*.json'],
  resolve: {
    alias: {
      '/app_data': './app_data'
    }
  }
});

import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000, // Change this if you have another service running on 3000
    open: true // Automatically open the browser on server start
  },
  build: {
    outDir: 'dist', // Output directory for the build
    chunkSizeWarningLimit: 1000 // Increase the chunk size limit to 1 MB (1000 KB)
  },
  resolve: {
    alias: {
      '@': '/src' // Optional: Short path for importing files
    }
  },
  publicDir: 'src'
});

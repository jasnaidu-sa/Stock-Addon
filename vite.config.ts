import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  envDir: '.',
  build: {
    // Production build optimizations
    minify: 'esbuild',
    sourcemap: false, // Disable source maps in production for security
    rollupOptions: {
      output: {
        // Optimize chunk splitting
        manualChunks: {
          vendor: ['react', 'react-dom'],
          clerk: ['@clerk/clerk-react'],
          supabase: ['@supabase/supabase-js'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select'],
        },
      },
    },
  },
  esbuild: {
    // Remove console.log in production
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
  server: {
    // Development server security
    host: '127.0.0.1', // Bind to localhost only
    port: 5173,
    strictPort: true,
    // Add security headers in development
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
    },
  },
  preview: {
    // Preview server configuration
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
    },
  },
});

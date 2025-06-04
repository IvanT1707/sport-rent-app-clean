import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode` in the current directory.
  // Load .env.production when building for production
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    server: {
      port: 3001, // Different port for frontend in development
      proxy: {
        '/api': {
          target: 'http://localhost:3000', // Backend URL in development
          changeOrigin: true,
          secure: false,
        },
      },
    },
    define: {
      // Make environment variables available to the app
      'process.env': process.env,
      __APP_ENV__: JSON.stringify(env.NODE_ENV || 'development'),
    },
    base: '/',
    build: {
      outDir: 'dist',
      sourcemap: true,
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: {
            // Split vendor chunks for better caching
            react: ['react', 'react-dom', 'react-router-dom'],
            firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          },
        },
      },
    },
  };
});
// Author: Joao Machete
// Description: Vite configuration file for the project, including environment variable loading,
// process.env polyfills, and path alias setup for simplified imports. Ensures correct build and
// development environment for the app.
//
// API calls now use relative /api/* paths in all environments:
//   - Production: nginx ingress proxies /api/* → localhost:8081 (FastAPI sidecar)
//   - Development: Vite dev server proxies /api → http://localhost:8081

import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        chunkSizeWarningLimit: 7000,
        rollupOptions: {
          output: {
            manualChunks: {
              vendor: ['react', 'react-dom'],
              d3: ['d3'],
              markdown: ['react-markdown', 'rehype-highlight'],
            }
          }
        }
      },
      server: {
        proxy: {
          // In dev, forward /api/* to the local FastAPI instance on port 8081.
          // Run the API with: cd api && uv run uvicorn main:app --port 8081
          '/api': {
            target: 'http://127.0.0.1:8081',
            changeOrigin: true,
          },
        },
      },
    };
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Base path: Use VITE_BASE_PATH env var, or default to '/'
  // For GitHub Pages, set VITE_BASE_PATH=/greedy/
  // For Azure Static Web Apps, use default '/'
  base: process.env.VITE_BASE_PATH || '/',
  server: {
    port: 5173,
  },
});

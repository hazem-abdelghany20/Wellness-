import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      input: {
        main:  resolve(__dirname, 'index.html'),
        hr:    resolve(__dirname, 'hr.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
});

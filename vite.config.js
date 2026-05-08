import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: '/calc-platinum-vue/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      // Proxy NBRK RSS feed to avoid CORS in development
      '/api/nbrk': {
        target: 'https://nationalbank.kz',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nbrk/, ''),
      },
    },
  },
  build: {
    // Для встраивания в существующий сайт можно использовать библиотечный режим:
    // lib: {
    //   entry: './src/main.js',
    //   name: 'PlatinumCalc',
    //   fileName: 'platinum-calc',
    // },
    outDir: 'docs',
    sourcemap: false,
  },
});

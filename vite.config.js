import { defineConfig } from 'vite';
export default defineConfig({
  base: '/3Dexample/',
  build: { rollupOptions: { output: { manualChunks: { three: ['three'], animation: ['gsap', 'gsap/ScrollTrigger'] } } } },
});

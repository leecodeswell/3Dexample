import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

// Serve and package the uploaded source byte-for-byte, without copying or re-exporting it.
export default defineConfig({
  plugins: [{
    name: 'original-watch-asset',
    configureServer(server) {
      const asset = readFileSync(new URL('./mechanical watch.glb', import.meta.url));
      server.middlewares.use((req, res, next) => {
        if (decodeURIComponent(new URL(req.url, 'http://localhost').pathname) !== '/mechanical watch.glb') return next();
        res.setHeader('Content-Type', 'model/gltf-binary');
        res.setHeader('Content-Length', asset.byteLength);
        res.end(req.method === 'HEAD' ? undefined : asset);
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'mechanical watch.glb', source: readFileSync(new URL('./mechanical watch.glb', import.meta.url)) });
    },
  }],
  build: {
    rollupOptions: { output: { manualChunks: { three: ['three'], animation: ['gsap', 'gsap/ScrollTrigger'] } } },
  },
});

// #715: the sketchbook's own Vite build. Separate from the game's build on purpose: a second input in the
// same build would make Rollup split three.js into a chunk shared by the sketchbook and the game's lazy
// `solids` chunk, which `scripts/bundle-single.mjs` cannot inline (a chunk that imports another chunk) and
// which the #714 chunk rails hold against. Built into `dist/sketchbook/` after the game's build, served by
// the same `vite preview` at `/sketchbook/sketchbook.html`, excluded from the service worker's precache.
// `publicDir: false` — the avatars it shows beside an object come from the game's own `dist/` at `/avatars/`.
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/sketchbook/',
  publicDir: false,
  build: {
    outDir: 'dist/sketchbook',
    emptyOutDir: true,
    rollupOptions: { input: 'sketchbook.html' },
    chunkSizeWarningLimit: 800,   // three.js is ~530 kB minified and does not tree-shake; that is the page's one job
  },
});

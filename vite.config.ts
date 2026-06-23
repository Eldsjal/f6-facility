import { defineConfig } from 'vite';

// Static site; `base: './'` makes the production build portable to itch.io,
// GitHub Pages subpaths, or a plain file server.
export default defineConfig({
  base: './',
  server: { host: true },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
});

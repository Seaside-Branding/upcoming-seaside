import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  // The lazy-loaded intro chunk bundles three.js and only downloads when the intro plays.
  vite: { build: { chunkSizeWarningLimit: 700 } }
});

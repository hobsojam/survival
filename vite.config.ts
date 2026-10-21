import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset paths so the build works under GitHub Pages' /survival/ path.
  base: './',
  test: { environment: 'node' }
});

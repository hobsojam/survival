import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset paths so the build works under GitHub Pages' /survival/ path.
  base: './',
  test: {
    environment: 'node',
    // Agent worktrees live under .superpowers/ and carry their own copies of the tests.
    exclude: [...configDefaults.exclude, '.superpowers/**'],
    // CI hands the lcov report to SonarCloud; locally run `npm test -- --run --coverage`.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text-summary', 'lcov']
    }
  }
});

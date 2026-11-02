import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset paths so the build works under GitHub Pages' /survival/ path.
  base: './',
  test: {
    environment: 'node',
    // Keep the stylesheet's text for the test that checks every panel's buttons are styled.
    css: { include: [/style\.css/] },
    // Agent worktrees and Stryker sandboxes carry their own copies of the tests.
    exclude: [...configDefaults.exclude, '.superpowers/**', '.stryker-tmp/**'],
    // CI hands the lcov report to SonarCloud; locally run `npm test -- --run --coverage`.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text-summary', 'lcov']
    }
  }
});

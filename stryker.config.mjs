export default {
  testRunner: 'vitest',
  // TypeScript 7 no longer exports the legacy compiler API Stryker uses to rewrite tsconfig.
  // This project has no external tsconfig references, so copying tsconfig.json unchanged works.
  tsconfigFile: '.stryker-unused-tsconfig.json',
  mutate: ['src/game/food.ts'],
  reporters: ['progress', 'html', 'json'],
  concurrency: 2,
  thresholds: { break: null },
  ignorePatterns: ['.superpowers/**', 'docs/**', 'dist/**', 'coverage/**'],
  htmlReporter: { fileName: 'reports/mutation.html' },
  jsonReporter: { fileName: 'reports/mutation.json' }
};

# Weekly mutation testing

The project already runs Vitest and coverage on each pull request. Add a separate mutation run to reveal game rules that tests execute but do not assert strongly enough. This first run is a measured pilot, not a new pull-request gate.

## Approach

Use StrykerJS with its Vitest runner. Mutate only `food.ts` to cover meaningful state transitions while keeping the first run bounded. Stryker's TypeScript config preprocessor still expects the legacy compiler API, which TypeScript 7 no longer exposes. This project's `tsconfig.json` has no external references, so point that preprocessor at an unused path and let the sandbox copy the actual config unchanged. Schedule a dedicated GitHub Actions workflow once a week and allow manual dispatch. Upload the local HTML and JSON reports as a workflow artifact. Do not fail the workflow based on mutation score until the first reports and runtimes are reviewed.

## Constraints

- Keep the existing PR CI and weekly dependency audit behavior unchanged.
- Run on Node 24, which satisfies Stryker's current Node 22 minimum.
- Give the scheduled job a 60-minute timeout; report a timeout as an infrastructure failure.
- Do not publish reports to an external dashboard or introduce secrets.
- Document the local command and the meaning of the first report.
- Keep `npm audit --audit-level=moderate` green, using audited transitive overrides where needed.

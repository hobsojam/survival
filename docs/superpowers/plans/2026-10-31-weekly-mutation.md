# Weekly Mutation Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task by task.

**Goal:** Add an informational weekly mutation test for selected game logic.

**Architecture:** Stryker runs the existing Vitest suite against mutations in the food rules module. A separate scheduled and manually runnable GitHub Actions workflow uploads the report.

**Tech Stack:** StrykerJS 10.1.1, Vitest 5, Node 24, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-31-weekly-mutation-design.md`

## Global Constraints

- Preserve existing PR checks and weekly audit.
- No mutation-score failure threshold in the pilot.
- Do not mutate tests, UI, scene, or art files.

## Review Focus

- The scheduled job runs only on the default branch and can be manually dispatched.
- A low mutation score does not fail the workflow.
- Reports are retained as workflow artifacts even when the mutation run fails.
- The local mutation command works with the repository's Vitest configuration.
- CI uses a Node version supported by both Stryker packages.

---

### Task 1: Configure Stryker

**Files:** `package.json`, `package-lock.json`, `stryker.config.mjs`

- [ ] Install matching Stryker core and Vitest runner versions.
- [ ] Keep the existing audit gate green with patched transitive packages.
- [ ] Add an npm script and a config limited to food logic.
- [ ] Run Stryker's dry run and a bounded mutation smoke test.

### Task 2: Schedule and document

**Files:** `.github/workflows/mutation.yml`, `README.md`

- [ ] Add weekly and manual triggers, a 60-minute timeout, and report upload.
- [ ] Explain the local command, artifact, and informational pilot in README.
- [ ] Run tests, lint, build, and inspect the final diff.

### Task 3: Deliver

- [ ] Commit and push the branch.
- [ ] Open a pull request against `main`.

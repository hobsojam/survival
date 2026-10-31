# Sonar Behavior Refactor Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement the independent tasks, then verify them together.

**Goal:** Reduce cognitive complexity in four behavior-heavy functions and remove four existing nested ternaries without changing game behavior.

**Architecture:** Extract small named decisions from existing game, audio, and scene functions. Keep public interfaces and observable results intact.

**Tech Stack:** TypeScript, Vitest, Vite, SonarCloud.

**Spec:** The open SonarCloud issues on `main` for `warmthChange`, `syncAmbience`, `addCamp`, `updateRabbit`, and nested ternaries in `companion.ts`, `soundscape.ts`, `wolves.ts`, and `panels.ts`.

## Global Constraints

- Preserve behavior and public interfaces.
- Do not introduce nested ternaries.
- Prefer helpers that name a domain decision over helpers that merely hide branches.
- Confirm targeted tests before and after each refactor; add focused tests only for uncovered behavior.

## Review Focus

- Warmth in daylight, rain, shelter, cold nights, summer, and with a cloak.
- Audio volumes at camp and quarry across seasons and day/night.
- Camp visuals for each shelter upgrade and buildable site.
- Rabbit appearance, flight, hiding, and return.
- Animal offering and wolf visit choices, and clearing UI copy.

---

### Task 1: Game rules and animal choices

**Files:** `src/game/rules.ts`, `src/game/companion.ts`, `src/game/wolves.ts`, relevant tests.

- [ ] Run focused baseline tests.
- [ ] Extract a named warmth-loss decision and replace the animal-choice nested ternaries.
- [ ] Run focused tests and inspect the diff.

### Task 2: Audio ambience

**Files:** `src/game/soundscape.ts`, `tests/soundscape.test.ts` if needed.

- [ ] Run focused baseline tests.
- [ ] Extract named volume decisions and replace the nested cricket ternary.
- [ ] Run focused tests and inspect the diff.

### Task 3: Camp visuals

**Files:** `src/scene/visuals.ts`, relevant tests.

- [ ] Run focused baseline tests.
- [ ] Extract shelter and structure placement from `addCamp`.
- [ ] Run focused tests and inspect the diff.

### Task 4: Rabbits and clearing copy

**Files:** `src/scene/ambientLife.ts`, `src/ui/panels.ts`, relevant tests.

- [ ] Run focused baseline tests.
- [ ] Extract rabbit movement transitions and replace the clearing-copy nested ternary.
- [ ] Run focused tests and inspect the diff.

### Task 5: Integration

- [ ] Run `npm test -- --run`, `npm run lint`, and `npm run build`.
- [ ] Review changed lines for nested ternaries and use Sonar analysis if available.
- [ ] Commit, push, and open a PR.

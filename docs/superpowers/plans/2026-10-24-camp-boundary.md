# Camp Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make the visible camp clearing match the gameplay boundary and make its rim stones readable.

**Architecture:** Keep the existing static terrain texture and palette sprite system. Generate circle and path edge tiles from exact pixel distances so the four one-tile paths join the gameplay circle. Replace the 8 px rim stone decals with 12–16 px outlined variants and place 16–20 around the circle, excluding sprite footprints that cross a path.

**Tech Stack:** TypeScript, Vitest, Phaser canvas textures.

**Spec:** [Issue #29](https://github.com/hobsojam/survival/issues/29) and `docs/superpowers/specs/2026-10-21-pixel-art-direction.md`.

## Global Constraints

- Keep gameplay radius, camp and node coordinates, palette, and whole-pixel art placement unchanged.
- Do not introduce nested ternary expressions.
- Capture day and phone views with the survivor just inside and just outside the boundary.

## Review Focus

- Ground under a player near a diagonal boundary must agree with `isAtCamp`.
- Paths must remain one tile wide and meet the clearing without extra earth wedges.
- Rim stones must stay aligned to whole art pixels and avoid important camp objects.
- All terrain sprite definitions must pass existing art validation.
- Existing saves and gameplay must remain unaffected.

---

### Task 1: Align the clearing edge

**Files:** `src/scene/map.ts`, `tests/map.test.ts`

- [x] Write a failing map test that samples visible earth at tile centres around the camp and compares it with the gameplay radius, excluding the four paths.
- [x] Run `npm test -- --run tests/map.test.ts` and confirm the expected mismatch.
- [x] Adjust the clearing mask and path connection in `buildMap()` while retaining the terrain sprite system.
- [x] Run the focused test and full test suite.

### Task 2: Strengthen the boundary markers

**Files:** `src/art/terrain.ts`, `src/scene/map.ts`, `tests/map.test.ts`, `tests/art.test.ts`

- [x] Write a failing test for 16–20 rim stones on the radius and 12–16 px stone sprites.
- [x] Run the focused tests and confirm the expected failures.
- [x] Draw outlined, higher contrast stone variants and place them without covering path entrances.
- [x] Run focused tests and full test suite.

### Task 3: Visual review and handoff

**Files:** `docs/art-review/camp-boundary/`, this plan.

- [x] Capture day and phone screenshots from valid saves with the survivor just inside and just outside the rim.
- [x] Inspect the images for circle fit, path joins, marker visibility, and pixel alignment; adjust if needed.
- [x] Run `npm test -- --run`, `npm run build`, `npm run lint`, and `git diff --check`.
- [x] Review changed TypeScript lines for nested ternaries, then commit and open a PR for issue #29.

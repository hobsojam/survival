# Camp Clearing Edge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the camp clearing edge look naturally worn beside the new footpaths while keeping its visible footprint aligned with the gameplay boundary.

**Architecture:** Keep `clearingReach` and the exact earth-versus-grass mask. Vary only earth shades within the inside rim. Vary stone angles modestly around that same boundary, leaving path entrances clear.

**Tech Stack:** TypeScript, Phaser pixel sprites, Vitest.

## Global Constraints

- Do not change gameplay clearing geometry or path routes.
- Preserve a pixel-accurate visible footprint and all path gaps.
- Keep winter behavior and grown clearing steps working.
- Do not introduce nested ternary expressions.

## Review Focus

- Fresh and grown camp footprints still match `clearingReach`.
- Rim colours remain earth, with no continuous darkest outline.
- Stone positions stay at the gameplay radius and clear paths.
- Stone spacing varies without clumping.
- New textures are deterministic across redraws.

---

### Task 1: Worn earth edge

**Files:** `src/art/terrain.ts`, `tests/map.test.ts`.

- [ ] Change the exact old-circle test to assert the same pixel footprint rather than old colour symbols; add an assertion that edge earth has several shades and no `earth0`.
- [ ] Run the focused test and observe the new colour assertion fail.
- [ ] Render a varied one-to-three-pixel inside rim with earth tones while preserving every earth/grass pixel decision.
- [ ] Run the focused map tests, then commit.

### Task 2: Natural stone spacing

**Files:** `src/scene/map.ts`, `tests/map.test.ts`.

- [ ] Add a test that stone angles are not perfectly equal while every stone stays near the reach and clear of paths.
- [ ] Run it and observe the spacing assertion fail.
- [ ] Apply a small deterministic angular offset per stone, retaining the count logic and radius.
- [ ] Run map tests, build, lint and the full suite; inspect a terrain preview if available; commit.

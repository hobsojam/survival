# Pixel Art Phase 4 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task. Steps use checkbox syntax.

**Goal:** Replace the temporary survivor sprite with the directional and action animations in the approved pixel art direction.

**Architecture:** A 16 × 24 palette-indexed survivor definition supplies every frame to the existing texture pipeline and contact sheet. Pure pose-selection functions map input, warmth, successful actions, and elapsed time to a frame and horizontal flip. `GameScene` retains only the current facing and short-lived action pose.

**Tech Stack:** TypeScript, Phaser 4, Vite, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-21-pixel-art-direction.md`, Phase 4.

## Global Constraints

- Preserve gameplay, balance, save format, map coordinates, and the 16 px world grid.
- Use only existing palette colors and whole-pixel positions; all survivor frames share one anchor.
- Do not introduce nested ternary expressions.

## Review Focus

- A left-facing survivor flips the side art; up and down art keep the correct orientation after movement stops.
- Walking uses four frames at 8 fps; idle breathes at 2 fps without moving its anchor.
- Gather, rest, cook, and stargaze poses play only after successful actions and then expire.
- Warmth at or below 20 selects shiver when the survivor is otherwise idle.
- The survivor remains legible at 1× phone scale and under the current night tint.

---

### Task 1: Survivor sprite sheet

**Files:** Create `src/art/survivor.ts`; modify `src/art/sprites.ts`, `src/art/sceneSprites.ts`, and `tests/art.test.ts`.

- [x] Add a failing test for 16 × 24 size, all named frames, animation sequences, palette validation, and a shared anchor.
- [x] Run the focused test and confirm that the production sprite is missing the requested frames.
- [x] Draw idle-down (2), walk-down/up/side (4 each), gather/rest/cook/stargaze/shiver (2 each) as palette-indexed pixel frames.
- [x] Run the focused test and full suite.

### Task 2: Pure pose selection and scene integration

**Files:** Create `src/scene/survivorVisual.ts` and `tests/survivorVisual.test.ts`; modify `src/scene/GameScene.ts`.

- [x] Add failing tests for facing, frame timing, left flip, action expiry, and cold idle priority.
- [x] Run the focused test and confirm the selector is missing.
- [x] Implement pure selection and connect it to `GameScene` input and successful actions without changing game state.
- [x] Run the focused test and full suite.

### Task 3: Visual review

**Files:** Create `docs/art-review/phase-4/README.md` and capture images.

- [x] Capture idle, walking, gathering, resting, cooking, stargazing, shivering, phone, and contact-sheet states.
- [x] Inspect the contact sheet at native scale and the in-game day view.
- [x] Run the full suite, production build, and changed-lines nested-ternary review.

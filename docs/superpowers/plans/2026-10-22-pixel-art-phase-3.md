# Pixel Art Phase 3 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task. Steps use checkbox syntax.

**Goal:** Replace placeholder resource and camp art with the approved Phase 3 sprites while preserving game state and coordinates.

**Architecture:** Palette-indexed sprite definitions remain the single source for Phaser textures and the contact sheet. Pure scene visual selection maps existing game state and elapsed time to sprite frames; the scene only presents those selections and brief gather animation.

**Tech Stack:** TypeScript, Phaser 4, Vite, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-21-pixel-art-direction.md`, Phase 3.

## Global Constraints

- Keep gameplay, balance, save format, resource coordinates, and camp-site coordinates unchanged.
- Use only palette keys and whole art pixels. Preserve the 16 px tile and existing contact sheet pipeline.
- Keep the existing terrain, survivor, wildlife, and time-of-day system for their later phases.

## Review Focus

- Ready and depleted branch, berry, and fiber sprites remain distinct without halos.
- Every build site and built object is present at the existing camp positions, including the unlocked hearth site.
- Fire pit and hearth have different silhouettes and readable unlit, low, burning, and windy frames.
- Node movement and fire frame changes preserve anchors and whole-pixel placement.
- Saved camps with every structure built still load and render without missing textures.

---

### Task 1: Resource and camp sprite definitions

**Files:** `src/art/sceneSprites.ts`, `src/art/sprites.ts`, `tests/art.test.ts`.

- [x] Add failing tests for Phase 3 sprite sizes, frames, animations, palette validation, and distinct silhouettes.
- [x] Run the focused test and observe the expected failures.
- [x] Define branch, berry, fiber, fire, hearth, build site, structure, and log seat frames using palette-indexed pixels.
- [x] Run the focused test and the suite; commit.

### Task 2: Scene state selection and animation

**Files:** `src/scene/visuals.ts`, `src/scene/GameScene.ts`, `tests/visuals.test.ts`.

- [x] Add failing tests for ready/depleted and sway frames, low/windy fire, hearth-site unlock, and log seats.
- [x] Run the focused test and observe the expected failures.
- [x] Select frames from game state and time; play a brief rustle when a berry node is gathered.
- [x] Run the focused test and the suite; commit.

### Task 3: Visual review

**Files:** `docs/art-review/phase-3/README.md` and PNG captures.

- [x] Capture the spec's camp, meadow, time-of-day, cold-front, hearth, contact sheet, and phone scenes at integer scale.
- [x] Inspect the captures for silhouettes, depth, palette, and alignment; correct concrete issues.
- [x] Run all tests and the production build; commit review artifacts.

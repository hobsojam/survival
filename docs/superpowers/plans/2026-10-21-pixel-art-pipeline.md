# Pixel Art Pipeline Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task. Steps use checkbox syntax.

**Goal:** Establish Phase 1 of the approved pixel art direction while keeping the existing game playable.

**Architecture:** Pure sprite definitions and palette data feed a rasterizer used by both Phaser canvas textures and a standalone dev contact sheet. The existing procedural scene stays temporarily visible through a half-scale adapter as the logical world moves from 32 to 16 pixels per tile.

**Tech Stack:** TypeScript 7, Phaser 4, Vite 8, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-21-pixel-art-direction.md`, Phase 1.

## Global Constraints

- Do not change gameplay, balance, save format, resource-node coordinates, or camp-site coordinates.
- Logical game size is 480 × 300, with a 16 px tile and whole-pixel camera positions.
- Palette-indexed strings define each 16 px test sprite; no procedural drawing in the new sprite pipeline.
- The contact sheet is a development page only and is excluded from the production bundle.

## Review Focus

- The existing art and wildlife must stay aligned with the halved world coordinates.
- Desktop scaling must be integer and phone scaling must still fit within the frame.
- Transparent pixels and shadow alpha must survive conversion to canvas textures.
- Saved camps must keep their exact gameplay coordinates and load after the renderer change.
- Sprite frames with unknown palette symbols or wrong dimensions must fail validation.

---

### Task 1: Palette, definitions, and texture pipeline

**Files:** Create `src/art/palette.ts`, `src/art/sprites.ts`, `src/art/textures.ts`, `tests/art.test.ts`.

**Interfaces:** `SpriteDef`, `sprites`, `validateSprite`, `rasterizeFrame`, `registerSpriteTextures(scene)`.

- [ ] Write tests for frame dimensions, symbol resolution, anchors, transparency, palette bytes, and invalid frames.
- [ ] Run `npm test -- --run tests/art.test.ts` and confirm red.
- [ ] Implement palette, two prototype sprite definitions, validation, rasterization, and Phaser canvas texture registration.
- [ ] Run the focused test and confirm green; commit.

### Task 2: Contact sheet

**Files:** Create `sprites.html`, `src/art/contactSheet.ts`; update `README.md`.

- [ ] Show every registered frame at 4× on grass, earth, and night backgrounds, with sprite name and size.
- [ ] Keep `sprites.html` out of production `dist/`; verify it through Vite development server.
- [ ] Document the dev page and commit.

### Task 3: 16 px world and temporary legacy-art adapter

**Files:** Modify `src/scene/art.ts`, `src/scene/ambientLife.ts`, `src/scene/GameScene.ts`, `src/ui/App.ts`, `src/style.css`.

- [ ] Change exported `TILE` to 16 and game logical resolution to 480 × 300.
- [ ] Add nearest-neighbour Phaser/CSS settings and integer desktop scaling with fit below 2×.
- [ ] Render old procedural world and wildlife at half their former logical size so existing gameplay remains visible until later phases replace them.
- [ ] Round player and camera rendering to whole art pixels; keep gameplay coordinates untouched.
- [ ] Run all tests and production build; verify the contact sheet is absent from `dist/`; inspect desktop and phone if browser tooling is available; commit.

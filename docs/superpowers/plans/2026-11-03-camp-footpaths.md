# Camp Footpaths Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make camp footpaths look walked into the meadow and make the west route meet the quarry track cleanly.

**Architecture:** Keep the existing route geometry. Replace the camp's solid path overlay with deterministic world-pixel mottling and a narrow, dithered irregular edge. Reduce the quarry track width only across its eastmost few tiles, using the same exit width as camp.

**Tech Stack:** TypeScript, Phaser pixel sprites, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-03-camp-footpaths-design.md`

## Global Constraints

- Preserve all camp routes, access, winter path palette, and gameplay clearing.
- Keep the camp visible width near one tile; retain the quarry's broad track away from its east exit.
- Introduce no nested ternary expressions.

## Review Focus

- Camp path centres remain continuously covered through the clearing entrance.
- Camp path fringe remains within the existing stone and tree clearances.
- The west path remains absent before the shelter and present after it.
- The quarry track remains broad by the floor and narrows at its east edge.
- Path pixels still use seasonal palette keys in winter.

---

### Task 1: Camp worn paths

**Files:** Modify `src/art/terrain.ts`; test `tests/map.test.ts`.

**Interfaces:** Keep `pathTile(x, y, destinations): string | undefined` unchanged. Add private deterministic pixel helpers using `mixHash`.

- [ ] Add focused assertions for centre continuity, limited width, edge texture, and seasonal path keys.
- [ ] Run `npx vitest run tests/map.test.ts` and confirm the new assertions fail against the old path appearance.
- [ ] Render the path pixels with a mottled path palette, slight world-space wobble, and a dithered edge, staying inside the current test's width bound.
- [ ] Run `npx vitest run tests/map.test.ts` and confirm it passes.
- [ ] Commit the camp path change.

### Task 2: Quarry exit taper

**Files:** Modify `src/scene/quarryGeometry.ts`, `src/art/terrain.ts`; test `tests/map.test.ts`.

**Interfaces:** Add private `trackHalfWidth(x: number): number` and `trackEdgeOut(x: number): number` in quarry geometry; export the latter only if terrain rendering needs it.

- [ ] Add focused assertions that the track is broad near the floor and near camp width at the east map edge.
- [ ] Run `npx vitest run tests/map.test.ts` and confirm the new assertions fail against the old width.
- [ ] Taper the quarry track's half-width from 0.8 to about 0.5 over the last four tiles, retaining its existing mottled pixels and soft edge.
- [ ] Run `npx vitest run tests/map.test.ts` and confirm it passes.
- [ ] Review day and winter scene captures if available; run `npm run build` and `npm run lint`.
- [ ] Commit the taper and checks.

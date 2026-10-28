# Seasonal Garden Implementation Plan

> **For agentic workers:** Implement this plan inline. Steps use checkbox syntax for tracking.

**Goal:** Add a small perennial berry garden whose planting, growth, harvest, save state, camp art, and controls follow the existing seasons.

**Architecture:** Add a Garden building and three plot records to `GameState`; keep seasonal status and plot actions in the existing game rules. The scene draws one garden bed plus separate plant sprites per plot, while the Camp tab exposes planting and harvest controls.

**Tech Stack:** TypeScript, Phaser, Vite, existing pixel sprite registry and seasonal calendar.

**Spec:** `docs/superpowers/specs/2026-10-28-seasonal-garden-design.md`

## Global Constraints

- Keep the existing 40-day calendar and its ten-day seasons.
- Use existing berry inventory as planting material; add no resource or meter.
- Plants and ready harvests never expire from neglect.
- Do not migrate old test saves; use save version 17.

## Review Focus

- Spring planting on the last day of spring still starts the summer growth stage after time advances.
- A ready harvest remains available through season changes and reloads until picked.
- A plot cannot be planted twice or harvested twice in the same autumn.
- Harvest refuses to consume the crop when the bag cannot hold both berries.
- Garden and plot state cannot be forged in a save without a built garden or valid planting history.

---

### Task 1: Garden state and save shape

**Files:** `src/game/state.ts`, `src/game/save.ts`

- [x] Add a `garden` building definition costing 4 wood and 2 fiber.
- [x] Add `GardenPlot` with `plantedYear`, `harvestedYear`, and `harvestReady`; initialize exactly three empty plots in `createGame()`.
- [x] Increment `SAVE_VERSION` from 16 to 17 and validate the exact plot count, field types, year ordering, readiness, and garden prerequisite.
- [x] Update the save-version comment and design records.

### Task 2: Garden cycle and actions

**Files:** `src/game/rules.ts`, `src/game/garden.ts`

- [x] Add garden stage/label helpers to derive status and action labels from season and plot state.
- [x] Add plant and harvest actions with integer plot-index validation, camp/build checks, spring-only planting, one-berry planting cost, two-berry harvest, and standard gather time/energy costs.
- [x] At autumn dawn, make each planted plot ready unless harvested in the current year; preserve readiness through later seasons until harvested.
- [x] Reject harvest when fewer than two bag spaces are free without changing the state.

### Task 3: Garden art in camp

**Files:** `src/art/phase3Sprites.ts`, `src/scene/visuals.ts`

- [x] Draw a three-plot garden bed, with separate seedling, growing, ripe, and dormant plant frames; empty plots show bare soil.
- [x] Add the garden at an open camp offset. Add one plant visual per saved plot and select its frame from the seasonal plot view.

### Task 4: Camp controls

**Files:** `src/ui/App.ts`, `src/ui/panels.ts`, `src/style.css`

- [x] Add a three-plot Garden panel to the Camp tab, hidden until the garden is built.
- [x] Show each plot's season/status, plant or harvest action, missing-berry hint, and full-bag hint.
- [x] Route plot-index actions through the existing scene action path and refresh the panel after state changes.

### Task 5: Verification and review

- [x] Run `npm run lint` and `npm run build`.
- [x] Run `git diff --check` and review changed TypeScript for nested ternaries.
- [x] Review the sprite frames and confirm the garden does not overlap the shelter, fire, or other camp structures.

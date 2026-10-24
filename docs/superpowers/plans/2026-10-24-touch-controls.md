# Touch Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Hearthwild playable on a portrait phone: tap to walk and act, a full-screen game, and a thumb-reach action dock.

**Architecture:** A pure module, `src/scene/tapTarget.ts`, turns a tap point into a target, steps the survivor toward it, detects arrival, and maps the target to a `GameAction`. `GameScene` owns one optional walk target, drives it from `update()`, and fires the action on arrival through `perform()`. The phone layout stays in CSS: sidebar sections get `data-tab` tags, and a new dock (action row and tabs) shows one tagged group at a time as a sheet over the game. Portrait frames get a taller viewport, through `pixelScale.ts`.

**Tech Stack:** TypeScript, Phaser 4, Vite, Vitest, oxlint.

**Spec:** `docs/superpowers/specs/2026-10-24-touch-controls-design.md`

## Global Constraints

- No new runtime dependencies. `SAVE_VERSION` and the saved shape do not change.
- Walking speed is the keyboard's: 3.5 tiles/s through the `move` action, so `movementFactor` applies.
- Act range is `BALANCE.interactionRadius` (2 tiles); the campfire uses `isAtCamp` (`BALANCE.campRadius`, 4 tiles).
- Tap hit radius: 1 tile from an object's tile position; the closest to the tap wins; objects beat ground.
- The phone layout applies at `(max-width: 600px) and (orientation: portrait)`. Every other size keeps today's layout.
- Phone buttons are at least 44×44 CSS px. `touch-action: none` on the game frame. No page scroll on phone portrait.
- `npm run lint`, `npm test -- --run`, and `npm run build` pass. Avoid nested ternaries (repo convention).

## Review Focus

- A tap while a gather or build is running: the existing rule message appears, and the walk doesn't fight the action. Test in Task 2's browser check.
- A tap while the start screen or the lookout ending overlay is up must not walk. The scene is paused or hidden; verify in Task 2.
- A tap on the game while a dock sheet is open only closes the sheet. Test in Task 4.
- A tap past the map edge clamps to the edge and arrives instead of walking forever. Pinned by `moveStep`/`hasArrived` tests in Task 1.
- Desktop at 1000×640: the layout is pixel-identical to `main`, and WASD still cancels a click-walk. Verify in Task 5.

---

### Task 1: Tap target logic

**Files:**
- Create: `src/scene/tapTarget.ts`
- Test: `tests/tapTarget.test.ts`

**Interfaces:**
- Produces:
  - `type TapTarget = { kind: 'node'; id: string; x: number; y: number } | { kind: 'tree'; id: string; x: number; y: number } | { kind: 'site'; id: SiteId; x: number; y: number } | { kind: 'lookout'; x: number; y: number } | { kind: 'fire'; x: number; y: number } | { kind: 'ground'; x: number; y: number }` (x and y in tile units, the same space as `state.player`)
  - `TAP_HIT_RADIUS = 1`, `WALK_SPEED = 3.5`
  - `pickTapTarget(state: GameState, x: number, y: number): TapTarget`
  - `hasArrived(state: GameState, target: TapTarget): boolean`
  - `moveStep(state: GameState, target: TapTarget, dt: number): { dx: number; dy: number }` (raw, before `movementFactor`, like the keyboard's step)
  - `targetAction(target: TapTarget): GameAction | null`

- [ ] **Step 1: Write the failing tests** in `tests/tapTarget.test.ts`, using `createGame()`:
  - `picks a node within one tile of the tap`: with node `branch-0` at (nx, ny), `pickTapTarget(state, nx + 0.8, ny)` → `{ kind: 'node', id: 'branch-0' }` (use `toMatchObject`).
  - `ignores depleted nodes`: set that node's `amount = 0` → the result's `kind` is `'ground'`.
  - `prefers the object closest to the tap`: two nodes within the hit radius; the nearer one's id wins.
  - `picks trees, sites, the lookout and the campfire`: a tap at a tree's tile gives `kind 'tree'`; at `SITES.spring` gives `{ kind: 'site', id: 'spring' }`; at `LOOKOUT` gives `kind 'lookout'`; at (`BALANCE.campX`, `BALANCE.campY`) gives `kind 'fire'`.
  - `falls back to ground clamped to the map`: `pickTapTarget(state, -5, 99)` → `{ kind: 'ground', x: 0, y: BALANCE.mapHeight - 1 }`.
  - `arrives within interaction radius for objects and camp radius for the fire`: put the player 1.9 tiles from a node → `true`; 2.1 tiles → `false`; 3.9 tiles from camp with a `fire` target → `true`.
  - `arrives at ground within 0.1 tile`.
  - `steps toward the target at walking speed without overshooting`: player at (0,0), ground at (10,0), `moveStep(..., 0.1)` → `{ dx: 0.35, dy: 0 }` (toBeCloseTo); ground at (0.2,0) → `dx` ≈ 0.2.
  - `maps targets to actions`: node → `{ type: 'gather', nodeId }`, tree → `{ type: 'chopTree', treeId }`, site → `{ type: 'visitSite', siteId }`, lookout → `{ type: 'repairLookout' }`, fire → `{ type: 'stokeFire' }`, ground → `null`.

- [ ] **Step 2: Run them to make sure they fail**
  Run: `npx vitest --run tests/tapTarget.test.ts`. Expected: FAIL, because the module can't be resolved.

- [ ] **Step 3: Implement `src/scene/tapTarget.ts`**
  `pickTapTarget` gathers candidates (nodes with `amount > 0`, all trees, `SITES`, `LOOKOUT`, and the fire at camp) within `TAP_HIT_RADIUS` of the tap, and returns the nearest. Otherwise it returns clamped ground. Trees are always candidates, so a stump tap walks over and shows the regrow message. `moveStep` returns a vector toward the target of length `min(WALK_SPEED * dt, distance)`. Object targets stop being stepped once `hasArrived` is true, so the scene never walks into an object's tile.

- [ ] **Step 4: Run the tests and make sure they pass**
  Run: `npx vitest --run tests/tapTarget.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit** `git add src/scene/tapTarget.ts tests/tapTarget.test.ts && git commit -m "Add tap target selection and walking"`

### Task 2: Tap to walk and act in the scene

**Files:**
- Modify: `src/scene/GameScene.ts`

**Interfaces:**
- Consumes: everything Task 1 produces; `facingFromInput` from `survivorVisual.ts`.
- Produces (for Task 4): `GameScene.setTapGate(gate: () => boolean): void`. When the gate returns `false`, a tap is swallowed and never walks. Also `GameScene.cancelWalk(): void`.

- [ ] **Step 1: Add pointer handling.** In `create()`, listen for `this.input.on('pointerdown', ...)`. Convert to tile units with `pointer.worldX / TILE - 0.5` (and the same for y, the inverse of `worldX`/`worldY`). Skip the tap if the gate returns `false`. Otherwise, `pickTapTarget`; if `hasArrived` is already true, act at once; else store the result as `walkTarget`. Show a short tap marker at the target: a small ring drawn with `this.add.graphics()` that fades in about 400 ms, styled per `2026-10-21-pixel-art-direction.md`.
- [ ] **Step 2: Drive the walk in `update()`.** Any movement key down clears `walkTarget`. While there's a target, `hasArrived` → clear it, then `perform(targetAction(target))` when it isn't `null`. Otherwise, `this.perform({ type: 'move', ...moveStep(...) }, false)`. Set `walking` and `facing` from the step's signs, so the walk animation plays.
- [ ] **Step 3: Cancel on other actions.** In `perform()`, clear `walkTarget` for any action except `move`. The arrival path clears it before calling `perform`, so it isn't affected. Add `cancelWalk()` and `setTapGate()`.
- [ ] **Step 4: Verify.** Run `npm run lint && npm test -- --run && npm run build`; all pass. Then in `npm run dev` on a desktop browser:
  - Click ground and the survivor walks.
  - Click a berry bush and they walk, then gather.
  - Click the fire from afar, holding wood, and they feed it.
  - Click a tree without an axe and the "Craft a stone axe…" message appears on arrival.
  - Press W mid-walk and the walk stops.
  - Click during a gather and the rule message appears.
  - Clicks on the start screen and the lookout ending overlay don't walk.
- [ ] **Step 5: Commit** `git commit -am "Walk and act on tap or click"`

### Task 3: Portrait viewport

**Files:**
- Modify: `src/scene/pixelScale.ts`
- Test: `tests/pixelScale.test.ts`

**Interfaces:**
- Produces: `viewportSize(width, height)` keeps its signature. When `height > width`, the height cap becomes `PORTRAIT_MAX_HEIGHT = 480` (the map's 30 tiles × 16 px) instead of `LOGICAL_HEIGHT`.

- [ ] **Step 1: Write the failing test** `grows the viewport to fill portrait phone frames`: `viewportSize(390, 640)` → `{ width: 390, height: 480 }`; `viewportSize(390, 400)` → `{ width: 390, height: 400 }`; the existing landscape expectations stay unchanged.
- [ ] **Step 2: Run** `npx vitest --run tests/pixelScale.test.ts`. Expected: FAIL on the new test.
- [ ] **Step 3: Implement the portrait cap.** `displayScale` stays at 1 for these frames, because it fits against 480×300, so `App.fitCanvas` already takes the `viewportSize` branch and calls `resizeViewport` for lighting.
- [ ] **Step 4: Run** `npx vitest --run tests/pixelScale.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -am "Fill tall portrait frames with the game view"`

### Task 4: Phone dock and sheets

**Files:**
- Modify: `src/ui/App.ts` (markup, listeners, `render`, `setMessage`)
- Modify: `src/style.css`
- Create: `src/ui/dock.ts`
- Test: `tests/dock.test.ts`

**Interfaces:**
- Consumes: `GameScene.setTapGate`, `GameScene.cancelWalk` (Task 2).
- Produces: `type DockTab = 'bag' | 'build' | 'camp'`; `nextOpenTab(open: DockTab | null, tapped: DockTab): DockTab | null`, which returns `null` when the open tab is tapped again and `tapped` otherwise.

- [ ] **Step 1: Write the failing test** in `tests/dock.test.ts`: `nextOpenTab(null, 'bag')` → `'bag'`; `nextOpenTab('bag', 'bag')` → `null`; `nextOpenTab('bag', 'build')` → `'build'`.
- [ ] **Step 2: Run** `npx vitest --run tests/dock.test.ts`. Expected: FAIL. Then implement `src/ui/dock.ts` and rerun. Expected: PASS.
- [ ] **Step 3: Markup.** Tag each sidebar section with `data-tab`:
  - **bag:** the survivor panel and the bag panel. The trail food (ration) panel also goes here, under its current class name.
  - **build:** the lookout panel, the axe panel, and the build panel.
  - **camp:** the forecast, sites, and night panels, plus a new phone-only section containing a New game button. That button calls `beginNewGame()`, like `#restart-game`.

  Add a compact meters element, `#phone-meters` (energy, hunger, warmth bars), inside `.game-frame`. After `.layout`, add `<nav class="phone-dock">` with:
  - **An action row:** `data-action` buttons for eat, rest, stokeFire and sleep, with labels Eat, Rest, Fire and Sleep. Add cook and stargaze buttons, hidden unless their blocker is null; when shown, they're added to the row as extra slots.
  - **Tabs:** three `data-tab-button` buttons, labeled 🎒 Bag, 🔨 Build and 🌙 Camp.

  Dock action buttons reuse the existing `[data-action]` listener. Bind it after the dock markup exists.
- [ ] **Step 4: Behavior.**
  - A tab click sets `layout.dataset.openTab` from `nextOpenTab` (or deletes it on `null`) and calls `scene.cancelWalk()`.
  - The tap gate passed to `scene.setTapGate` returns `false` and closes the sheet when a tab is open. Otherwise it returns `true`.
  - In `render()`, update `#phone-meters`; show the cook and stargaze dock buttons when `cookBlocker` / `stargazeBlocker` is null; set a `has-dot` class on the Build tab when the build-tagged sections contain any `.ready` element.
  - `setMessage` adds a `toast` class to `#message` and removes it after 3 s, restarting the timer on each new message.
- [ ] **Step 5: CSS, all inside `@media (max-width: 600px) and (orientation: portrait)`.**
  - `.shell` is `height: 100dvh` with no page overflow.
  - The topbar is slimmed, and the brand subtitle, `#restart-game` (it moves to the Camp sheet), shortcuts, and keyboard prompt are hidden.
  - `.game-frame` flexes to fill the space and gets `touch-action: none`.
  - `#phone-meters` sits top-left over the game, and `#message` is an absolutely placed toast that's visible only with `.toast`.
  - `.phone-dock` is a fixed bottom panel. Its buttons are at least 44 px tall, with `touch-action: manipulation`.
  - The sidebar becomes a sheet over the lower game, at most about 60% of the height, scrolling internally. Hide it unless `[data-open-tab]` is set, and then show only the sections whose `data-tab` matches.
  - Inside the bag sheet, hide the survivor panel's meters and every quick-action button except `#eat-ration-button`.
  - Outside this media query, `.phone-dock`, `#phone-meters` and the camp New game section are `display: none`.
- [ ] **Step 6: Verify.** Run `npm run lint && npm test -- --run && npm run build`; all pass. At 390×844 with touch emulation:
  - The page doesn't scroll.
  - Tabs open and close.
  - With the Build sheet open, a tap on the game closes it without walking.
  - Building from the Build sheet works.
  - Eat ration is in the Bag sheet.
  - The toast appears and fades.
  - The Build tab shows a dot only at camp with enough resources.
- [ ] **Step 7: Commit** `git add -A src tests && git commit -m "Add phone dock with action row and sheets"`

### Task 5: Docs and full playthrough

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document touch play.** In "How to play", add a sentence saying that you can tap or click to walk, and that tapping a supply, tree, place, the lookout, or the campfire walks there and uses it. Also say that on a phone held upright, the everyday actions sit in a bottom row, with Bag, Build and Camp tabs. Leave the wider README catch-up to issue #55.
- [ ] **Step 2: Playthrough at 390×844 with touch:**
  - Walk and gather each supply kind.
  - Chop a tree with an axe (seed a save, or use a dev console state edit).
  - Feed the fire, visit the spring, build from the Build tab, eat, and sleep.
  - Reload, then continue.
- [ ] **Step 3: Desktop regression at 1000×640:** compare the layout against `main`. Keyboard play works, and WASD cancels a click-walk.
- [ ] **Step 4: Run** `npm run lint && npm test -- --run && npm run build`. Expected: all pass.
- [ ] **Step 5: Commit** `git commit -am "Document tap and phone controls"`

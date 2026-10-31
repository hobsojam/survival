# Tidy Build List and Self-Storing Materials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- The "Little improvements" list shows only what can be built.
- Wood, fiber and stone store themselves whenever the survivor is in the clearing.
- A new **Camp stores** panel in the Bag tab shows the stores and the larder.

**Architecture:**
- A new module, `src/game/stores.ts`, owns `settleStores`. While the survivor is in the clearing, it moves bag wood, fiber and stone into their stores as far as they have room, then empties the handcart into the wood store.
- `applyAction` runs it after every action that changed the state. The manual store, take and unload actions go.
- `buildButtonView` gains a `shown` flag, and the build list hides built and blocked items.
- A `campStoresView` drives the new panel, and the larder's markup moves into it.

**Tech Stack:** TypeScript, Phaser 3, Vite, Vitest (node), oxlint.

**Spec:** This was agreed with the user in chat on 2026-10-31. There's no separate design document, so this plan's Global Constraints are the spec.

**Commits:** the user asked to approve before committing. Stop at each commit step and ask.

## Global Constraints

- **The build list** shows an item only when `buildStatus` is `'ready'` or `'unavailable'` (short of materials, outside the clearing, or exhausted). Items that are `'built'`, `'locked'`, `'needsShelter'`, `'needsPrerequisite'` or `'needsGround'` are hidden.
- **The "Shelter upgrades" heading** shows only while one of `shelterThatched`, `shelterStonework`, `shelterPorch` or `shelterFinished` is shown.
- **An empty list** (nothing to show, and the Clear the land group hidden or not) shows the hint `'Nothing new to build for now. Clear more land or explore to find what comes next.'` in place of `'Stand anywhere in the clearing to build.'`.
- **Self-storing:**
  - It runs only when `isInClearing(state)` is true.
  - Order: bag wood → wood store (up to `woodStoreCapacity`), bag fiber → fibre stack (up to `fibreStackCapacity`, only once it's built), bag stone → stone pile (up to `stonePileCapacity`, only once it's built), then `cartWood` → wood store.
  - Whatever doesn't fit stays where it was.
  - There's no message. The action's own message stands.
  - **Food never moves by itself.** The larder keeps its Store 1 and Take 1 buttons.
- **Removed actions:** `storeStone`, `takeStone`, `storeWood`, `takeWood`, `storeFiber`, `takeFiber` and `unloadCart`, with their blockers and their buttons. `storeFood` and `takeFood` stay.
- **The Camp stores panel** sits in the Bag tab (`data-tab="bag"`), right after the survivor panel, with the eyebrow `CAMP STORES`. It's hidden until any of these exists: the woodpile, the house (for its woodshed), the fibre stack, the stone pile, the larder or the handcart. Its lines, each shown only once its store exists:
  - `Wood 20/36` (`storedWood`/`woodStoreCapacity`)
  - `Fiber 5/12`
  - `Stone 6/12`
  - `Cart 3/12`
  - the larder's existing controls (`larderMarkup`), moved here unchanged
- **The workshop panel** keeps only its three upgrade rows. The cart row and the Unload button go.
- **The save format doesn't change.** No `SAVE_VERSION` bump, and `tests/fixtures/save-v23.json` must keep loading.
- **Copy** is plain and warm, with no exclamation marks.
- Every task passes `npm test`, `npm run lint` and `npm run build` before committing.

## Review Focus

1. **A refused action** (for example, building without enough wood while standing in the clearing with wood in the bag). It returns the *same* state object, with nothing stored. Settling runs only when the handler changed the state. Task 1 pins this.
2. **Full stores.** With the woodpile full, gathered wood stays in the bag, and nothing is lost or over-filled. With room for 2 of 5, exactly 2 move. Task 1 pins this.
3. **Outside the clearing** (the quarry, or the paths beyond the clearing's edge), nothing moves. Walking back into the clearing (a `move` action) stores it. Task 1 pins this.
4. **Felling into a full bag at the clearing's edge, then stepping in.** The bag's wood stores itself, and the cart then empties into what room is left. Wood is never lost and capacities are never exceeded. Task 1 pins this.
5. **The frozen save.** It still loads, and loading doesn't move anything. Settling runs on actions, not on load. Task 1 pins this with a check that a loaded fixture's `inventory` equals the file's.

---

### Task 1: Materials store themselves

**Files:**
- Create: `src/game/stores.ts`, `tests/stores.test.ts`
- Modify:
  - `src/game/rules.ts`: remove the seven actions, `unloadCartBlocker` and their `GameAction` members. `applyAction` settles a changed state.
  - `src/ui/App.ts`: remove the stone, wood and fibre store controls from `buildMarkup`, the workshop's `cart-row`, and the removed names in the `data-action` union and in `renderBag` and `renderWorkshop`
  - `src/ui/panels.ts`: drop `unloadCartBlocker` and the `cart` part of `workshopView`, and drop `pileShown`, `pileStored`, `woodShown`, `woodStored`, `fiberShown` and `fiberStored` from `BagView`. Task 3 shows those numbers in the new panel.
  - Tests that used the removed actions (`tests/rules.test.ts`, `fibreStack.test.ts`, `woodpile.test.ts`, `bagCapacity.test.ts`, `workshop.test.ts`, `savePlay.test.ts`, `house.test.ts`). Delete tests that only covered the removed actions. Rewrite tests that used them as setup, setting `storedWood`, `storedStone` or `storedFiber` directly. Where an existing assertion now sees materials in the store instead of the bag, update the expectation to the new truth, and never loosen it to `toBeGreaterThan`.

**Interfaces:**
- Produces: `export function settleStores(state: GameState): GameState`. It returns the same object when nothing moves.

- [ ] **Step 1: Write the failing tests in `tests/stores.test.ts`**
  - **Moving into the stores:** in the clearing, with the woodpile, fibre stack and stone pile built and empty, a bag of 3 wood, 2 fiber and 1 stone settles to an empty bag and `storedWood: 3`, `storedFiber: 2`, `storedStone: 1`.
  - **Food stays put:** food in the bag is untouched.
  - **Capacity:**
    - with the woodpile at 10 of 12 and 5 wood in the bag, 2 move and 3 stay
    - with the woodpile full, nothing moves, and the result is the same object (`toBe`)
  - **No store, no move:** without a fibre stack, fiber stays in the bag. Without a woodpile or house, wood stays.
  - **The handcart:** with `cartWood: 7` and room for 4, it settles to `cartWood: 3`, with the store full. Bag wood moves before cart wood: with bag 3, cart 7 and room for 5, the result is bag 0, cart 5 and the store full.
  - **Outside the clearing:** `area: 'quarry'`, or a spot outside `isInClearing`, returns the same object.
  - **Through `applyAction`:**
    - gathering a branch in the clearing with a woodpile leaves the bag's wood at 0 and adds 1 to `storedWood`, and the message is the gather's own
    - a `move` from outside into the clearing stores the bag's wood
    - Review Focus 1: a refused `build` in the clearing, with wood in the bag and room in the woodpile, returns `toBe(state)`
  - **Review Focus 5:** `loadGame` of `tests/fixtures/save-v23.json` gives an `inventory` equal to the file's.
  - **Removed actions:** `applyAction(state, { type: 'storeWood' } as never)` returns `'That action is not available yet.'`.

- [ ] **Step 2: Run `npx vitest run tests/stores.test.ts`.** Expected: it fails because the module is missing.

- [ ] **Step 3: Implement it.**
  - `stores.ts` imports from `camp`, `home` and `state` only.
  - In `applyAction`, apply `settleStores` only when `result.state !== state`.
  - Remove the actions and the UI pieces listed above.
  - Then run the whole suite, and fix every failing test as the Files section says.

- [ ] **Step 4: Run `npm test && npm run lint && npm run build`.** Expected: all pass.

- [ ] **Step 5: Ask the user, then commit:** `Store wood, fiber and stone by themselves in the clearing`

### Task 2: Show only what can be built

**Files:**
- Modify:
  - `src/ui/panels.ts`: `BuildButtonView` gains `shown: boolean`. A new `export function buildListView(state: GameState): { shelterHeading: boolean; empty: boolean; hint: string }`.
  - `src/ui/App.ts`: `renderBuildButton` sets `button.hidden = !view.shown`. The "Shelter upgrades" heading gets `id="shelter-upgrades-heading"` and is hidden from `buildListView`. `#build-hint` takes `buildListView(...).hint`.
- Test: `tests/panels.test.ts`

**Interfaces:**
- Consumes: `buildStatus` (existing)

- [ ] **Step 1: Write the failing tests**
  - On a new game, `shown` is true for the shelter and for each building with no prerequisite and no ground (`dryingRack`, `garden`, `stonePile`, `windbreak`). It's false for `bed`, `toolshed`, `hearth`, `larder`, `house` and the four shelter upgrades.
  - A built item and a `needsGround` item are hidden. An `unavailable` item (short of wood) is shown.
  - `buildListView`:
    - `shelterHeading` is true with the shelter built and its thatch not yet done
    - `shelterHeading` is false on a new game, and false with the shelter finished
  - With every building built, `empty` is true and the hint is `'Nothing new to build for now. Clear more land or explore to find what comes next.'`. Otherwise the hint is `'Stand anywhere in the clearing to build.'`.

- [ ] **Step 2: Run `npx vitest run tests/panels.test.ts`.** Expected: the new tests fail.

- [ ] **Step 3: Implement it.**

- [ ] **Step 4: Run `npm test && npm run lint && npm run build`.** Expected: all pass.

- [ ] **Step 5: Ask the user, then commit:** `Show only what can be built in the build list`

### Task 3: The Camp stores panel

**Files:**
- Modify:
  - `src/ui/panels.ts`: `export function campStoresView(state: GameState): { shown: boolean; lines: { id: 'wood' | 'fiber' | 'stone' | 'cart'; text: string; shown: boolean }[] }`
  - `src/ui/App.ts`: a `<section class="panel stores-panel" id="stores-panel" data-tab="bag" hidden>` right after the survivor panel, with `<p class="eyebrow">CAMP STORES</p>`, one `<p id="store-line-${id}" class="store-line">` per line, and `larderMarkup()` moved in from the build list. `renderLarder` keeps working on the moved markup.
  - `src/style.css`: style `.store-line` like the existing `.stone-pile-controls` span text.
  - `README.md`: in the build and stores paragraphs, replace every **Store 1** and **Take 1** for wood, fiber and stone, and **Unload the cart**, with the self-storing rule and the Camp stores panel. Describe the build list showing only what can be built. The larder's Store 1 and Take 1 stay.
- Test: `tests/panels.test.ts`

**Interfaces:**
- Consumes: `settleStores` behaviour (Task 1), and `woodStoreCapacity` and `hasWoodStore` from `home.ts`

- [ ] **Step 1: Write the failing tests for `campStoresView`**
  - On a new game, `shown` is false.
  - With only the stone pile and `storedStone: 6`, `shown` is true and the shown lines are `[{ id: 'stone', text: 'Stone 6/12' }]`.
  - With the woodpile and the house (capacity 36), `storedWood: 20`, the fibre stack with 5, and the handcart with `cartWood: 3`, the shown texts are `Wood 20/36`, `Fiber 5/12` and `Cart 3/12`.
  - With only the larder, `shown` is true and no lines are shown.

- [ ] **Step 2: Run it.** Expected: it fails.

- [ ] **Step 3: Implement it.**

- [ ] **Step 4: Run `npm test && npm run lint && npm run build`.** Expected: all pass.

- [ ] **Step 5: Browser check** with Chromium at 1280×800 and at a 390×844 phone size, using crafted saves written with `saveGame`, in a scratchpad script. Check, with no console errors:
  - a new game's short build list, with the hint
  - a mid game with the shelter upgrades heading
  - a late game, with an empty list or only the clearing group
  - the Camp stores panel with every line and the larder
  - gathering a branch in the clearing, with the wood landing on the woodpile
  - the workshop panel without the cart row

- [ ] **Step 6: Ask the user, then commit:** `Add a Camp stores panel to the Bag tab`

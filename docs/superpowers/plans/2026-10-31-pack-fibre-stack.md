# Woven Pack and Fibre Stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the storage crate with a woven pack made at the toolshed, and give fiber a thatched store at camp.

**Architecture:** Fiber follows the stone and wood pattern. A pair, `availableFiber`/`spendFiber`, joins `availableWood`/`spendWood` in `src/game/camp.ts`, and the fibre stack is a `BUILDINGS` entry with `ground: 'east-near'`. It reuses the generic ground checks the larder and woodpile already use (`groundBlocker`, `'needsGround'`, the ground loop in `validLarder`, and the site skip in `visuals.ts`). The pack is a tool flag, `progress.packWoven`, made like the cooking pot. `bagCapacity` reads it, and the survivor sprite gains a pack variant of every frame.

**Tech Stack:** TypeScript, Phaser 3 (sprites drawn in code), Vite, Vitest (node), oxlint.

**Spec:** `docs/superpowers/specs/2026-10-30-pack-fibre-stack-design.md`

## Global Constraints

- Every task passes `npm test`, `npm run lint` and `npm run build` before it commits.
- `SAVE_VERSION` goes from 19 to **20** in Task 1 and stays there. Old saves are rejected, with no migrations.
- **Fibre stack:**
  - costs 2 wood and 3 fiber
  - holds 12 fiber (`BALANCE.fibreStackCapacity`)
  - needs `east-near` cleared
  - spot at offset **(5.5, 1.5)** from the fire, i.e. (25.5, 16.5)
- **Woven pack:**
  - costs 2 wood and 4 fiber
  - made in the Forest tools panel, with the toolshed, at camp
  - standard crafting time and energy (`payAndBuild`)
  - doesn't need the axe or the cold night
- Bag capacity is 16 with the pack (`BALANCE.packCapacity`, renamed from `crateCapacity`) and 8 without.
- Fiber used as a material counts from the stack wherever you are, bag first, as stone does. Burn (kindling) is at the fire, so it can use the stack too.
- The crate is removed completely: building, spot, sprites, save field, copy and README.
- Anti-goal: nothing else about the first days gets harder. No cost or rule outside this plan changes.
- Copy is plain and warm, with no exclamation marks. Art is drawn in code in the existing palette.

## Review Focus

1. **A full bag while taking fiber from the stack.** Take refuses with `FULL_BAG_MESSAGE`, and the bag never goes over capacity (an over-full bag makes saves invalid). Task 1 pins this.
2. **Every fiber spender.** Building, clearing the ground, the axe, pickaxe, pot and pack, the lookout repair and Burn all use bag fiber first, then the stack. A missed one blocks a build the player can afford. Task 1 greps for and tests each one; Task 2 covers the pack.
3. **A save made with the pack while holding 9–16 spaces.** It must load. Without the pack, the same save is invalid, because capacity is 8. Task 2 pins this.
4. **The survivor's pack in every frame.** Every survivor texture the scene can pick has a pack variant, so none is missing when `packWoven`. Task 2 pins this.

---

### Task 1: The fibre stack, and fiber from the stack everywhere

**Files:**
- Modify: `src/game/state.ts`, `src/game/camp.ts`, `src/game/rules.ts`, `src/game/clearing.ts`, `src/game/cooking.ts` (if `potBlocker` reads fiber), `src/game/save.ts`, `src/scene/visuals.ts`, `src/art/phase3Sprites.ts`, `src/ui/panels.ts`, `src/ui/App.ts`, `README.md`
- Create: `tests/fibreStack.test.ts`
- Modify tests that list every structure key (for example `tests/state.test.ts`) and the save tests

**Interfaces:**
- Produces:
  ```ts
  // state.ts
  fibreStack: { name: 'Fibre stack', description: 'Keep up to 12 fiber dry under thatch', symbol: '≋', cost: { wood: 2, fiber: 3 }, prerequisite: null, ground: 'east-near' }
  // GameState.storedFiber: number (createGame 0); BALANCE.fibreStackCapacity: 12
  // camp.ts
  export function availableFiber(state: GameState): number;          // bag + stack, from anywhere
  export function spendFiber(state: GameState, amount: number): GameState; // bag first
  // GameAction types: 'storeFiber' | 'takeFiber'
  // visuals.ts CAMP_STRUCTURES gains ['fibreStack', 5.5, 1.5]
  ```
- `SAVE_VERSION` = 20. `validFibreStack` checks that `storedFiber` is a whole count of at most 12, and 0 unless built. The generic ground loop covers `east-near`.

- [ ] **Step 1: Write the failing tests in `tests/fibreStack.test.ts`.**
  - **Ground and building:**
    - Before `east-near` is cleared, the build refuses with `"Clear the east side's near ground first."`
    - After clearing, it builds for 2 wood and 3 fiber.
  - **The spot:** (25.5, 16.5) passes the same checks as the woodpile's spot in `tests/woodpile.test.ts`:
    - inside `east-near` and outside the starting ring
    - at least 1.5 tiles from nodes placed for `['east-near']`, forage spots and wild trees
    - at least 1.35 from paths
    - at least 2 from the other `CAMP_STRUCTURES` spots and the shelter
  - **Store and Take:**
    - Messages: `'Tucked a bundle of fiber under the thatch.'` and `'Took a bundle of fiber from the stack.'`
    - Refusals: `'The fibre stack is full.'` at 12, `FULL_BAG_MESSAGE` on a full bag, `'Return to camp to use the fibre stack.'`, `'Build a fibre stack first.'`, `'You have no fiber to store.'` and `'The fibre stack is empty.'`
  - **Spending:** with 0 fiber in the bag and enough in the stack, every fiber spender works and takes from the stack. That covers a build, `clearGround`, `craftAxe`, `craftPickaxe`, `craftPot` (if it costs fiber), the lookout repair, and `burnFiber` at camp. With fiber in both, bag fiber is spent first.
  - **Save:** `storedFiber` of 12 is valid. 13, a fraction, a nonzero count while unbuilt, or a missing field is invalid. `structures.fibreStack` without `east-near` cleared is invalid. A version 19 save is rejected.
- [ ] **Step 2: Run `npx vitest run tests/fibreStack.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Replace every fiber sufficiency check (`state.inventory.fiber <`/`>=`) with `availableFiber`, and every fiber payment with `spendFiber`. Use `grep -rn "inventory.fiber" src` to find them all. Known ones are `buildStatus`, `missingCost`, `payAndBuild`, `axeBlocker`, `pickaxeBlocker`, `lookoutRepairBlocker`, `clearGroundBlocker` and `burnFiber`.
  - Burn's enabled state in `App.ts` follows `availableFiber` at camp and the bag elsewhere, the same as the wood Burn button.
  - Mirror the woodpile's store and take, and its controls: `#fibre-stack-controls` showing `Stored fiber n/12`, plus `+n at camp` on the bag's fiber cell.
- [ ] **Step 4: Draw `fibreStackSite` and `fibreStack`.** It has `empty`, `some` (1–6) and `full` (7–12) frames: a small rick of pale bundles under a thatched cap. Share one frame-picking helper with the larder and woodpile frames, rather than adding a third copy.
- [ ] **Step 5: Update the README.** Cover the fibre stack in "Camp stores", and the ground step's room line.
- [ ] **Step 6: Run `npm test && npm run lint && npm run build`.** Expected: all pass.
- [ ] **Step 7: Commit.** "Keep fiber dry in a thatched stack by the east ground"

### Task 2: The woven pack replaces the crate

**Files:**
- Modify: `src/game/state.ts`, `src/game/camp.ts`, `src/game/rules.ts` (or `cooking.ts`-style module placement for the pack blocker, whichever avoids a cycle), `src/game/save.ts`, `src/art/survivor.ts`, `src/scene/survivorVisual.ts` (and wherever the survivor texture is chosen), `src/scene/visuals.ts`, `src/art/phase3Sprites.ts`, `src/ui/panels.ts`, `src/ui/App.ts`, `README.md`
- Create: `tests/pack.test.ts`
- Modify every test that mentions the crate: `hud`, `panels`, `rules`, `state`, `visuals`, `save`, `art`, `needs` (`grep -rln crate tests`)

**Interfaces:**
- Consumes: `availableWood`/`spendWood`, `availableFiber`/`spendFiber`, `payAndBuild`.
- Produces:
  ```ts
  // state.ts: BUILDINGS.crate removed; BALANCE.crateCapacity renamed packCapacity (16)
  // progress.packWoven: boolean (createGame false); PACK = { cost: { wood: 2, fiber: 4, stone: 0 } }
  export function packBlocker(state: GameState): string | null;
  // GameAction type: 'craftPack'
  // camp.ts bagCapacity: packWoven ? BALANCE.packCapacity : BALANCE.baseCapacity
  // survivor.ts: every frame name has a `${name}Pack` twin; the scene picks it when packWoven
  ```

- [ ] **Step 1: Write the failing tests in `tests/pack.test.ts`.**
  - **The blocker, in order:**
    - `'You already have a woven pack.'`
    - `'Build a toolshed first.'`
    - `'Return to camp to weave the pack.'` (outside the clearing)
    - `TOO_TIRED_MESSAGE`
    - `'Need 2 wood and 4 fiber for the pack.'`
  - **Stores count:** with 0 in the bag, 2 wood on the woodpile and 4 fiber in the stack, the pack can be made, and it spends from the stores.
  - **Making it:** `craftPack` spends build time and energy, sets `packWoven`, and says `'You wove a pack. There\'s room for twice as much now.'` It works without the axe and without the cold night.
  - **Capacity:** `bagCapacity` is 8 without the pack and 16 with it.
  - **No crate:** `'crate' in BUILDINGS` is false, `CAMP_STRUCTURES` has no crate entry, and `sprites` has no `crate` or `crateSite`.
  - **Bag line:**
    - With the pack, `bagView(...).spaces` reads `'6/16 · woven pack'`.
    - Without it, `'6/8'`, plus a pack hint of `'Weave a pack at the toolshed to carry 16.'`, shown in the Bag panel.
  - **Survivor sprite:** every survivor frame has a `…Pack` twin of the same size. Every texture `selectSurvivorVisual` (or the scene's survivor texture choice) can return when `packWoven` names a frame that exists.
  - **Save (Review Focus 3):**
    - `progress.packWoven` must be a boolean, and true needs the toolshed.
    - `structures.crate` present means invalid.
    - A packed save carrying 12 spaces loads. The same save without the pack is invalid.
- [ ] **Step 2: Run `npx vitest run tests/pack.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Remove the crate everywhere: `BUILDINGS`, `createGame`, `CAMP_STRUCTURES`, the sprites and their draw functions, and the save validation and copy.
  - Add the pack row to the Forest tools panel, after the pot row: title "Woven pack", cost `'2 wood · 4 fiber'`, button `data-action="craftPack"`. Its view follows `potView`'s pattern.
  - Draw the pack as a `detail` in `survivor.ts`'s `frame()`: a small woven pack in the palette's straw and wood tones. It shows behind the shoulders on down and side poses, and fully on the up pose. The scene appends `Pack` to the chosen frame name when `packWoven`.
- [ ] **Step 4: Update the README.** Change the intro's structure list, the bag section (crate → pack), the Forest tools section (the pack) and the test list (`fibreStack`, `pack`). Remove every crate mention.
- [ ] **Step 5: Run `npm test && npm run lint && npm run build`.** Expected: all pass.
- [ ] **Step 6: Commit.** "Weave a pack at the toolshed in place of the storage crate"

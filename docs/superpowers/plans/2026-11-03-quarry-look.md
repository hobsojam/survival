# Quarry Look Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redraw the quarry area as a cut rock face over a pale gravel floor, reached by a soft worn track, inside a full band of woods, with no change to play.

**Architecture:**
- A new pure module, `src/scene/quarryGeometry.ts`, defines the shapes: the cliff, the floor and the track. It also has one classifier that says what any world pixel is.
- `terrain.ts` cuts that classifier into cached 16×16 ground tiles. This mirrors how path tiles are cached today.
- `map.ts` builds the quarry from those tiles, with no `pathTiles` and no random earth squares, and places trees, boulders and decorations clear of the new shapes.
- The `quarry` sprite shrinks to the worked spot at the face's foot. The face itself is terrain.

**Tech Stack:** TypeScript, Phaser, Vitest, oxlint (`--deny-warnings`).

**Spec:** `docs/superpowers/specs/2026-11-03-quarry-look-design.md`

## Global Constraints

- **No change to play.** Digging, rubble, loose piles, timers, prompts, costs, walking, and the area exit/entry stay the same. No save fields change and `SAVE_VERSION` stays as it is.
- **No collision.** Ruling: the cliff and the plateau above it stay walkable, as all ground is today. Blocking them would change play and could trap a saved survivor standing there. Trees stand thick on the plateau, so going up there reads as walking into the woods.
- **The sites stay where they are:** `QUARRY_SITE` (12,12), `RUBBLE_SITE` (16,16), `QUARRY_EXIT` (39,15) and `QUARRY_SIGN` (37,13). The new shapes are drawn around them, so prompts, rules and tests that use them stay valid.
- **Pixel art only.** Every pixel comes from the palette through a legend, with no smoothing. Soft edges are dithered, not blended.
- **The camp's terrain and paths are untouched.** `CAMP_PATHS`, `pathTile` and the camp tests stay as they are.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Winter.** The new quarry tiles use only legend keys that `seasonPalette` already recolours (grass, earth, stone, leaf), so the quarry turns wintry like everything else, with no unmapped colour left green. Test in Task 2.
2. **Every tile drawn.** Every ground name `buildMap([], 'quarry')` returns must be registered in `terrainSprites` before the scene asks for it. A missing one throws at draw time. Test in Task 2.
3. **Trees that hide the track.** A tree's crown reaches about 1.5 tiles above its trunk, so trunks keep at least 2.5 tiles from the track's centre line and at least 1 tile below the floor's edge. Test in Task 3.
4. **The signpost and exit stay readable.** Nothing stands within 1.5 tiles of the signpost, and the track runs off the east edge at the exit row. Test in Task 3.
5. **The worked-out face is still visible** (`quarry:spent`) and tappable at `QUARRY_SITE`. `pickTapTarget` still finds the quarry when you tap its sprite. Test in Task 4.

---

### Task 1: The quarry's shapes

**Files:**
- Create: `src/scene/quarryGeometry.ts`
- Modify: `src/scene/mapGeometry.ts` (the `QUARRY_PATHS` route now starts on the floor: `[[19, 14, QUARRY_EXIT.x, QUARRY_EXIT.y]]`)
- Test: `tests/quarryGeometry.test.ts`

**Interfaces:**
- Produces, all in tile units (world x and y, where a tile's centre is `x + .5`):
  - `faceBottom(x: number): number | null`. The y of the cliff's foot at this x, or null east of the cliff.
    - It's 11 for `x <= 14`, then climbs one tile per tile eastward to the cliff's east end at x = 18. Past that it's null.
    - The face is `FACE_HEIGHT = 2.5` tiles tall above its foot. Above the face is the plateau.
  - `floorDepth(x: number, y: number): number`. It's below 1 inside the gravel floor: an ellipse centred on (13.5, 14), rx 7, ry 4, with a ±0.12 hash wobble so the edge is uneven. The floor never reaches above the face's foot.
  - `trackDistance(x: number, y: number): number`. The distance to the track's centre line (the `QUARRY_PATHS` route). The track's half-width is `TRACK_HALF_WIDTH = 0.8`.
  - `export type QuarryGround = 'grass' | 'plateau' | 'lip' | 'face' | 'seam' | 'foot' | 'floor' | 'floorEdge' | 'track' | 'trackEdge'`.
  - `quarryGroundAt(px: number, py: number): QuarryGround`. For a world pixel (tile × 16 + pixel). It checks in this order:
    1. On the face band (between the foot and `foot - FACE_HEIGHT`): `seam` on the cut lines (every 13 px down and every 22 px across, offset 9 px per band), otherwise `face`.
    2. The bottom 2 px under the foot: `foot` (shadow).
    3. The top 3 px above the face: `lip`.
    4. Above the face: `plateau`.
    5. `floor` when `floorDepth < .92`. `floorEdge` from .92 to 1.04, for dithering.
    6. `track` when `trackDistance < TRACK_HALF_WIDTH`. `trackEdge` out to +0.2, for dithering.
    7. Otherwise `grass`.

- [ ] **Step 1: Write the failing tests.**
  - `'puts the dig spot on the floor just below the face'`: `floorDepth(12.5, 12.5) < .92`, `faceBottom(12) === 11`, and the dig spot is 1 to 2 tiles below the foot.
  - `'puts the rubble on the floor'`: `floorDepth(16.5, 16.5) < 1`.
  - `'runs the track from the floor to the exit'`: sample 40 points along the route. Each is `track` or `floor` by `quarryGroundAt` at its pixel centre. At the exit's centre it's `track`.
  - `'keeps the signpost off the track and the floor'`: at `QUARRY_SIGN` the ground is `grass`.
  - `'ends the cliff east of the dig spot'`: `faceBottom(19) === null`, and `faceBottom(16)` is between 11 and 8.
  - `'gives the track a soft edge, not an outline'`: across a vertical line through x = 30, the classes go grass → trackEdge → track → trackEdge → grass with no other class in between.

- [ ] **Step 2: Run them and watch them fail.**

  Run: `npx vitest run tests/quarryGeometry.test.ts`

  Expected: FAIL, because the module doesn't exist.

- [ ] **Step 3: Implement `quarryGeometry.ts` and change the route.** Use the same integer hash as `map.ts` (copy it or export it from `map.ts`; don't import `map.ts` into geometry if that makes a cycle).

- [ ] **Step 4: Run the file and the whole suite.**

  Run: `npx vitest run`

  Expected: the new tests pass. The existing quarry path tests in `map.test.ts` may now fail on the moved route start. Leave those for Task 3, and ledger which ones fail.

- [ ] **Step 5: Commit** "Shape the quarry's cliff, floor and track".

### Task 2: Ground tiles cut from the shapes

**Files:**
- Modify: `src/art/terrain.ts`. Add `quarryGroundTile(x: number, y: number): string`, cached by pixel shape like `pathSpriteFor`. Register every quarry tile up front, as is done for paths.
- Test: `tests/quarryGeometry.test.ts`

**Interfaces:**
- Consumes: `quarryGroundAt`, `QuarryGround`.
- Produces: `quarryGroundTile(x, y)` returns `grass${hash % 4}` (the existing grass tiles) for a tile that is all `grass`. Otherwise it returns a generated `quarryTile${n}` name.
- The pixel legend:

  | Class | Palette colours |
  |---|---|
  | `grass` | `grass1`/`grass2`/`grass3`, by a pixel hash |
  | `plateau` | as `grass`, with `grass4` tufts |
  | `lip` | `leaf3` / `leaf2` |
  | `face` | `stone2` / `stone3` by block, with a rare `stone4` speck |
  | `seam` | `stone1` |
  | `foot` | `shadow` |
  | `floor` | `stone3` / `earth4` / `stone4` / `earth3`, by a pixel hash |
  | `floorEdge` | floor or grass, by a pixel hash (dither) |
  | `track` | `earth3`, with `earth2` and `earth4` flecks |
  | `trackEdge` | track or grass, by a pixel hash (dither) |

- [ ] **Step 1: Write the failing tests.**
  - `'draws plain grass where nothing is worked'`: `quarryGroundTile(30, 25)` matches `/^grass\d$/`.
  - `'draws every quarry ground tile as a registered sprite'` (Review Focus 2): for every x and y on the map, `terrainSprites[quarryGroundTile(x, y)]` is defined.
  - `'uses only colours the seasons recolour'` (Review Focus 1): every generated quarry tile's legend values are in the set `seasonPalette` maps for winter. Read the keys from `seasonPalette('winter')` and assert each legend colour is a key there, or is a stone or shadow colour that the season leaves alone by design. Check `seasonPalette.ts` for which.
  - `'paints the face in stone with seams'`: the tile at (8, 9) has `stone1` pixels and `stone2` or `stone3` pixels, and no grass colours.

- [ ] **Step 2: Run and watch them fail.** Expected: `quarryGroundTile` isn't exported.

- [ ] **Step 3: Implement it.**

- [ ] **Step 4: Run the suite, tsc and lint.**

- [ ] **Step 5: Commit** "Cut the quarry's ground into tiles".

### Task 3: The quarry map

**Files:**
- Modify: `src/scene/map.ts` (`buildQuarryMap`, `layQuarryTile`, `quarryClear`, `QUARRY_CLUMPS`, `QUARRY_BOULDERS`)
- Test: `tests/map.test.ts` ("the quarry scenery" block, and `'the quarry map is rocky and wooded'`)

**Interfaces:**
- Consumes: `quarryGroundTile`, `floorDepth`, `faceBottom`, `trackDistance`.
- Produces: `buildMap([], 'quarry')`, where:
  - `ground[y][x] === quarryGroundTile(x, y)`
  - `pathTiles` is `[]`
  - there are no `earth*` ground tiles anywhere
  - the trees and decorations follow the rules below

The rules for trees:
- **Band.** A tree on every edge tile (edge distance 0). On edge 1, every tile but one in four (by hash). On edge 2, one in three.
- **Plateau.** Above the face, a tree on most tiles more than 1.5 tiles above the lip.
- **Clumps.** Inland clumps at `[[30, 8], [33, 23], [22, 5], [7, 24], [24, 22]]`. The old `[27, 17]` clump that stood over the track is removed.
- **Clear of everything.** Every tree trunk keeps:
  - at least 2.5 tiles from the track centre line,
  - out of the floor (`floorDepth >= 1.15`),
  - off the face band and lip, and not within 1 tile below the foot,
  - 1.5 tiles from the sign,
  - out of the exit corridor (as now).

The rules for boulders and decorations:
- Boulders keep their spots, minus any that are now on the floor, the face or the track. That's checked by the same clearance as trees, but at 1.35 from the track.
- Decorations (pebbles, tufts, mushrooms, rare stumps) only go on `grass` tiles.

- [ ] **Step 1: Rewrite the quarry tests.**
  - Replace `'wears a path from the quarry face to the way home'` and `'lays the path over grass'` with `'draws the track and floor in the ground, with no separate path tiles'`:
    - `pathTiles` is empty,
    - the ground at the exit is not a grass tile,
    - no ground name starts with `earth`.
  - Update `'rings the quarry with trees on every side'` to the fuller band:
    - at least 25 trees with `x <= 1`, at least 30 with `x >= mapWidth - 2`,
    - at least 40 with `y <= 1`, at least 40 with `y >= mapHeight - 2`.
  - Add `'keeps tree crowns off the track'` (Review Focus 3): every tree is at least 2.5 from the track centre line, and at `floorDepth >= 1.15`.
  - Add `'keeps the face and the floor clear'`: no tree or decoration has its tile on the face band or the floor.
  - Add `'plants the plateau above the face'`: at least 15 trees have `y < faceBottom(x) - FACE_HEIGHT - 1`.
  - Keep `'signposts the way home'` (Review Focus 4) and the boulder/exit/workings clearance test, with the track clearance at 1.35 for boulders and 2.5 for trees.
  - Adjust `'the quarry map is rocky and wooded, not a second meadow'`: with the fuller band, the quarry may have more trees than the camp. Assert stones ≥ 2× the camp's and at least 6 boulders. Drop the fewer-trees line, and ledger that as a ruling.
  - Update `'scatters quarry decorations across the open ground where the camp circle would be'` if it no longer holds. Keep its intent: open grass in the middle has some decoration.

- [ ] **Step 2: Run and watch them fail.**

  Run: `npx vitest run tests/map.test.ts`

  Expected: FAIL on the path tiles, earth squares, tree counts and track clearance.

- [ ] **Step 3: Implement the new `buildQuarryMap`.**

- [ ] **Step 4: Run the suite, tsc, lint and the build.**

- [ ] **Step 5: Commit** "Lay out the quarry around its cliff, floor and track".

### Task 4: The worked spot at the face's foot, and a look in the browser

**Files:**
- Modify: `src/art/phase3Sprites.ts` (the `quarry` sprite)
- Modify: `README.md` (only if any line describes the quarry's look; the mechanics text stays)
- Test: `tests/visuals.test.ts` or `tests/tapTarget.test.ts`, whichever already covers the quarry sprite

**Interfaces:**
- `quarry` becomes a 32×24 sprite, anchored at its bottom centre (`[16, 22]`), drawn at `QUARRY_SITE` as now.
  - `ready`: a big cut block standing proud at the face's foot, its top lit, with a chisel line. It should overlap the face's bottom edge so it reads as part of the cliff.
  - `spent`: a fresh pale notch where a block came out, with chips scattered on the gravel.
  - Remove `quarryTier` if nothing else uses it.

- [ ] **Step 1: Write the failing tests.**
  - `'draws the worked spot small enough to sit at the face\'s foot'`: `sprites.quarry.size` equals `[32, 24]`, and both frames exist.
  - `'still finds the quarry when you tap it'` (Review Focus 5): `pickTapTarget(quarryState, QUARRY_SITE.x, QUARRY_SITE.y - .5)` has kind `'quarry'`.

- [ ] **Step 2: Run and watch them fail.** Expected: the sprite size is `[40, 32]`.

- [ ] **Step 3: Redraw the sprite.**

- [ ] **Step 4: Run the suite, tsc, lint and the build, then check in the browser.**
  - Use the scratchpad playwright script `pw/quarry.mjs` with a quarry save, at 1920×1070, and also standing at the dig spot.
  - The track should be soft-edged and unbroken, ending on the floor. The cliff should read as a cut face. The woods should frame the area. No tree should cover the track.
  - Also check one winter-day save.

- [ ] **Step 5: Commit** "Draw the worked spot at the quarry face's foot".

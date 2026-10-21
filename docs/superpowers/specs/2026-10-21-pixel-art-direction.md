# Hearthwild: Pixel Art Direction

> **For agentic workers:** This spec replaces the current procedural shape art (`src/scene/art.ts`, the drawing in `src/scene/ambientLife.ts`, and the night tint, fire glow and cold-front wind in `GameScene`). Work through the phases in order, one PR per phase, each with the screenshots listed in [Review](#review). Do not change gameplay rules, balance values, the save format (`SAVE_VERSION` in `src/game/save.ts`), or map coordinates of resource nodes and camp sites.
>
> **Updated 2026-10-21** for features merged after the first draft: the cold-front night and stone hearth (#12), cooking and stargazing at night (#14), the favicon (#13), and fiber (#17). Scaling and review rules were tightened after the phase 1 review (#18).

## Why the current art fails

These are the specific problems to fix, not a general dislike:

1. **No value structure.** Ground, trees and bushes are all mid-value olive green. Nothing interactive stands out, so the screen reads as mush.
2. **Noise instead of texture.** Hundreds of random translucent ellipses on the ground create blotches with no meaning.
3. **Mixed perspective.** Trees are seen from above, the tent and survivor from the front, branch piles from an angle. There is no shared camera.
4. **Inconsistent scale.** A berry bush is as big as a tree; the shelter is bigger than a cluster of trees.
5. **Effects pretending to be art.** Glow halos under ready nodes look like stains. The camp is translucent ellipses plus a dotted circle that reads as a debug overlay. Firelight is additive circles with visible ring edges. The cold front is thin diagonal lines scrolling across the screen, and the hearth is the fire pit drawn with bigger grey circles.
6. **No rules.** Some shapes have outlines and some don't, shadows point in different directions, and colors are chosen per object rather than from a palette.

The fix is a system: a fixed palette, one grid, one camera, one light direction, and sprites built from rules. A modest sprite that follows the rules looks better than an elaborate one that doesn't.

## Style in one paragraph

Cozy top-down pixel art on a 16 px grid, in the family of Stardew Valley, Sprout Lands and Eastward's overworld: a three-quarter view (ground seen from above, objects show their top and front face), a warm hue-shifted palette, light from the top-left, soft dark outlines in each material's own darkest color, and small, purposeful animation. Clearings feel warm and lived in; the forest edge frames the scene. At night the fire is the brightest thing on screen.

## Technical rules

### Resolution and scaling

- **Art grid:** 1 tile = 16 × 16 art pixels. Change `TILE` from 32 to 16. Game logic stays in tile units, so rules and saves are unaffected.
- **Logical resolution:** 480 × 300. At 2× this is today's 960 × 600 canvas and shows the same 30 × 18.75 tiles.
- **Display scale:** use the largest whole-number scale that fits the frame (2× on a typical desktop, 3× on large screens), centred with letterboxing in the frame's background color. The page layout must let the game frame grow wide enough for 3× (1,440 px) on viewports about 1,900 px wide or more; don't cap it at a width that makes 3× unreachable.
- **Never scale below 1× or by a fraction.** Where the frame is too small for 2× (phones), render at 1× and resize the logical viewport to the frame instead, so the camera shows fewer tiles. Shrinking the whole 480 × 300 view drops whole art pixels, so 1 px outlines and details disappear.
- **Whole-pixel placement:** the canvas's on-page position must be a whole number of CSS pixels. Centring in a frame with an odd size gives half-pixel offsets that blur or double rows in some browsers; round the offsets.
- **Phaser config:** `pixelArt: true`, `roundPixels: true`, `antialias: false`. CSS on the canvas: `image-rendering: pixelated`.
- **Never** rotate, skew, scale by a non-integer, or draw at sub-pixel positions. Movement is float in game state but rendered at whole art pixels. Camera follow must also round. Flipping horizontally (`scaleX = -1`) is allowed.
- No Phaser `Graphics` shapes for art. Everything visible in the world is a texture made from a sprite definition, except the lighting layer described below.

### Sprite authoring format

Sprites are code: palette-indexed strings, one character per pixel, converted to Phaser textures at boot. This guarantees palette discipline and keeps sprites diffable.

```ts
// src/art/sprites/berryBush.ts
export const berryBush: SpriteDef = {
  size: [16, 16],
  anchor: [8, 15],           // pixel that sits on the tile position (feet / base)
  legend: { o: 'leaf0', d: 'leaf1', m: 'leaf2', l: 'leaf3', r: 'berry1', R: 'berry2', s: 'shadow' },
  frames: {
    ready: [
      '................',
      // ...16 rows of 16 characters; '.' is always transparent
    ],
    picked: [ /* ... */ ]
  }
};
```

- `src/art/palette.ts` holds every color as a named key (see [Palette](#palette)). Legends map characters to palette keys only, never to hex values.
- `src/art/textures.ts` turns definitions into textures (one canvas per frame, or one sheet per sprite) during `preload`/`create`, and registers animations.
- Group sprites by area: `terrain`, `nodes`, `camp`, `survivor`, `wildlife`, `effects`, `icons`.
- **Tests** (`tests/art.test.ts`): every frame has exactly `size` rows of exactly `size[0]` characters; every character is `.` or in the legend; every legend value is a palette key; anchors are inside the frame. Keep an explicit list of required sprites, frames and animations in the test, and have each phase add the ones from the [sprite list](#sprite-list) it delivers, so a phase can't quietly skip one.

### Contact sheet

Add a dev-only page, `sprites.html` (served by `npm run dev`, excluded from the production build), that shows every sprite and every animation at 4× on three backgrounds: the grass tile, the camp dirt tile, and night. The night sample must draw the sprite on grass and then lay the night tint over it at full strength (`night` at 55%), as the game will, rather than placing the sprite at full brightness on a flat night color. Label each with its name and size. This page is how sprites get reviewed before they reach the game. Include it in every art PR's screenshots.

## Palette

All colors are hue-shifted ramps: shadows lean cool (toward blue and purple), highlights lean warm (toward yellow). Index 0 is the darkest and is used as that material's outline. Use **only** these colors. If a sprite seems to need a new color, the answer is almost always a different choice from an existing ramp. Adding a color needs a note in the PR saying why.

| Ramp | 0 (outline) | 1 | 2 | 3 | 4 (highlight) |
|---|---|---|---|---|---|
| `grass` | `#2f5236` | `#3d6b3f` | `#5a8a45` | `#7aa64f` | `#a3c45e` |
| `leaf` (trees, bushes) | `#16302e` | `#1f4a3a` | `#2f6b44` | `#4a8f4c` | `#7db55a` |
| `earth` (camp, paths) | `#3a2620` | `#5c3d2b` | `#8a5f3c` | `#b58a5a` | `#dbb985` |
| `wood` | `#2e1c18` | `#573423` | `#85512f` | `#b07a47` | `#d9a86a` |
| `stone` | `#2b2d3a` | `#4d5161` | `#767b88` | `#a3a7ad` | `#d0d2cc` |
| `canvas` (tent, bedroll) | `#4a3a2c` | `#7a6448` | `#b39a6e` | `#d9c595` | `#f0e2b8` |
| `berry` | `#4a1426` | `#6b1e33` | `#b83a45` | `#e8665a` | `#ffc2a8` |
| `fire` | `#7a2614` | `#c4471c` | `#ef7d23` | `#ffb84a` | `#ffe58a` |
| `fox` | `#4a2014` | `#7a3418` | `#c25a24` | `#e88a3e` | `#f2e2c4` |
| `bird` | `#2e2420` | `#4a3528` | `#7d5a40` | `#b08a62` | `#e3c9a0` |
| `coat` (survivor) | `#3a1c22` | `#5e2a2e` | `#9c3f3a` | `#c9644c` | `#e88c6a` |
| `scarf` | `#5e3f1c` | `#8a5f22` | `#b7832f` | `#e3b552` | `#f5d98a` |
| `skin` | `#4a2a24` | `#8a5040` | `#c98a68` | `#efc39c` | `#fbe0c4` |
| `hair` | `#1c1418` | `#3a2826` | `#5e4038` | `#7e5a48` | `#9e7a60` |
| `flower` | `#5e3a6e` (violet) | `#e6c25a` (yellow) | `#f2f0e0` (white) | `#e88aa0` (pink) | `#8ab0e0` (blue) |

Singles:

| Key | Hex | Use |
|---|---|---|
| `ink` | `#1c1820` | Eyes and the tiniest details only. Never as a general outline. |
| `paper` | `#f7f1e1` | The lightest color. Never use pure white. |
| `beak` | `#e0a040` | Bird beaks and feet. |
| `shadow` | `#1a2a24` at 45% alpha | The only translucent color. Ground shadows under objects. |
| `night` | `#1a2140` | Night tint (lighting layer only). |
| `dusk` | `#f0a050` | Golden-hour tint (lighting layer only). |
| `dawn` | `#e8a0a8` | Dawn tint (lighting layer only). |
| `storm` | `#23405a` | Cold-front tint (lighting layer only). |
| `frost` | `#d8eef0` | Wind streaks and sleet flecks during the cold front. |
| `firefly` | `#e9f79a` | Firefly cores. |

Value plan, which matters more than hue:

- **Ground** sits in the middle values (`grass2`, `earth2`/`earth3`).
- **Decoration** (grass tufts, flowers, pebbles) stays within one step of the ground's value, so it adds texture without competing.
- **Interactive objects** (branch piles, berry bushes, fire, build sites, structures) get the strongest contrast: a full dark outline plus at least one highlight two or more steps above the ground value.
- **Trees** are darker and cooler than grass (`leaf1` to `leaf3`) so the forest frames the meadow without looking interactive.
- **The survivor** is the highest-contrast thing on screen by day: a warm red coat against cool green.

## Drawing rules

1. **Light from the top-left.** Highlights on top and left edges, shade on the bottom and right. No exceptions.
2. **Outlines:** every object gets a 1 px outline in its own ramp's index 0, not black. The outline can break (be skipped) on the top-left edge where the highlight is strongest. Ground tiles and decoration smaller than 8 px have no outline.
3. **Shadows:** one flat `shadow` ellipse under each standing object, centred on the anchor and offset 1 px right. Its width is about 70% of the object's width and its height is 3 to 5 px. No other shadow directions.
4. **Shape first:** block each sprite in as a silhouette with 2 or 3 tones, check it reads, then add highlight and detail. A sprite should be recognisable as a solid black silhouette.
5. **Avoid the classic pixel art mistakes:**
   - *Pillow shading* (dark edges all round, light in the middle): shade follows the light direction instead.
   - *Banding* (rows of same-length clusters stacked in parallel): vary cluster lengths.
   - *Jaggies* (lines whose steps go 1, 3, 1, 2): use regular step patterns (1-1-1, 2-2-2, 1-2-1-2).
   - *Orphan pixels and noise:* every pixel belongs to a cluster of at least 2, except deliberate sparkles.
   - *Too many colors per sprite:* 4 to 6 colors per material in one sprite, 12 at most in total.
6. **Readable states without effects:** a ready berry bush shows berries and a picked one doesn't; a full branch pile shows a stack and a depleted one shows two twigs on bare earth. Delete the glow halos.
7. **Animation is economical:** 2 to 4 frames, consistent timing, and the sprite's anchor never shifts between frames unless it's deliberate (a hop or bob).

## Camera and layering

- **Three-quarter top-down view** for everything. Ground is seen straight down. Trees, bushes, structures, wildlife and the survivor show their front face and a bit of their top.
- **Y-sorting:** every standing object (trees, nodes, structures, rocks, wildlife, survivor) gets `depth = anchor y in world pixels`, so the survivor passes behind a tree when standing above its trunk and in front when below. Ground and ground decals (paths, flowers, build-site markings) stay on a flat layer below.
- Trees stay non-blocking, since collision is out of scope. Keep them clear of the camp clearing, resource nodes (at least 1.5 tiles) and the main paths, so the survivor rarely walks through a trunk.

## Map composition

Keep every resource node and camp coordinate exactly where it is. Change only what surrounds them:

- **Forest border:** a band of dense, overlapping trees 2 to 3 tiles deep around all map edges, so the world has a frame instead of ending in flat grass. Canopies may extend past the map edge.
- **Groves, not scatter:** inside the border, place trees in 6 to 9 clusters of 3 to 7 trees, with open meadow between them. Placement is deterministic (seeded), as it is now.
- **Camp clearing:** a circle of `earth` ground whose edge matches `campRadius` to within half a tile, with a soft, irregular autotiled edge (see the terrain list). Mark the boundary with small stones every 2 to 3 tiles around the rim, so the gameplay rule (build inside the circle) is visible without a drawn line.
- **Worn paths:** narrow earth paths (1 tile wide, irregular) from the camp toward each of the 3 or 4 densest node areas. Purely decorative; they hint where to go.
- **Decoration:** grass tufts, small flowers in patches (not evenly sprinkled), pebbles, a few stumps and mushrooms. Keep the meadow mostly calm: 1 decorated tile in 4 at most.

## Lighting and time of day

Replace the flat night rectangle and the additive glow circles with one lighting layer:

- A full-screen `RenderTexture` above the world, filled with the tint for the current time, with light sources **erased** out of it.
- **Tint by time of day**, using the existing `darkness()` curve in `src/scene/ambient.ts` to drive it:
  - Day: no tint.
  - Golden hour (the last 30 s before nightfall): `dusk` at up to 12%.
  - Night: `night` at up to 55%.
  - Dawn (the first 25 s): fades from `night` through `dawn` at 15% to clear.
  - Cold front (`isColdNight()` in `src/game/rules.ts`): `storm` instead of `night`, at up to 64%, so storm nights read colder and darker than ordinary ones while the fire still cuts through.
- **Light shapes are stepped, not smooth:** each light is 3 concentric bands with hard edges (for example 100%, 60% and 30% erase), or a 2 × 2 ordered dither between bands. No smooth radial gradients, which look out of place next to pixel art.
- **Fire light:** the radius follows fuel (full at 60 s or more of fuel, shrinking to 60% as it nears zero) and flickers by ±1 art pixel on a 4-frame cycle in step with the flame animation. Unlit means no light. A built hearth adds one art pixel of radius per band: it should feel like a steadier, slightly bigger fire, not a different light.
- **Cold-front weather:** replace the scrolling lines with pixel wind streaks and sleet (see [Effects](#effects)) drawn above the lighting layer, in world space so they move with the camera, and snapped to the art grid. Keep them sparse: about 10 streaks and 20 flecks on screen. Flames on the fire pit and hearth switch to their windy frames.
- **Small lights:** fireflies (a 5 px stepped light each) and optionally the survivor's shelter doorway when the bed is built (a faint warm glow).
- The fire must be the brightest and warmest thing on screen at night, and the camp must still be readable at full darkness.

## Sprite list

Sizes are in art pixels (W × H). The anchor is bottom-centre unless noted.

### Terrain

| Sprite | Size | Frames / variants | Notes |
|---|---|---|---|
| Grass tile | 16 × 16 | 4 variants | Plain, two with tufts, one slightly darker patch. Picked by a deterministic hash of the tile position. Variants must tile seamlessly in any combination. |
| Earth/grass autotile | 16 × 16 | 16 tiles | Corner-based (2-corner Wang / marching squares) transitions between grass and earth, for the camp clearing and paths. Irregular, slightly lumpy edge with a 1 px `earth0` lip on the earth side. |
| Earth tile | 16 × 16 | 3 variants | Plain, pebbles, faint footprints. |
| Decorations | 8 × 8 to 16 × 16 | about 10 | Grass tufts (2), flower patches (3, using the `flower` ramp), pebbles (2), stump, mushroom pair, fallen leaf. Flat ground decals have no shadow. |
| Rim stone | 8 × 8 | 2 variants | Camp boundary markers. |
| Trees | 32 × 48 | 3 variants | Round broadleaf, pine, small young tree (24 × 32). Trunk base at the anchor. Canopy in clear clusters of leaves, not a smooth blob. |
| Rocks | 16 × 16 | 2 variants | Decorative boulders. |

### Resource nodes

| Sprite | Size | Frames | Notes |
|---|---|---|---|
| Branch pile | 16 × 16 | `ready`, `depleted` | Ready: 3 to 4 crossed sticks with clear ends, top highlighted. Depleted: two small twigs on an `earth` scuff. |
| Berry bush | 16 × 16 | `ready`, `picked`, `rustle` (2 frames) | Ready: 4 to 6 berries clearly visible as `berry` clusters with a `berry4` shine pixel. Picked: same bush, no berries, slightly paler. Rustle plays when gathered. |
| Fiber reeds | 16 × 16 | `ready`, `cut`, `sway` (2 frames) | Ready: a clump of 4 or 5 tall reed stalks in `grass3`/`grass4` with a `grass0` outline, topped with `canvas3`/`canvas4` seed heads, standing clearly above the grass with the tallest about 14 px. Cut: short `grass1` stubble with 2 or 3 pale `canvas2` cut ends; it must still read as a spot that will regrow, not as empty grass. Sway is a 1 px lean of the heads, played slowly and out of step between clumps. |

### Camp

| Sprite | Size | Frames | Notes |
|---|---|---|---|
| Fire pit | 24 × 24 | `unlit`; `burning` (4); `low` (4); `windy` (4) | Ring of 8 stones (`stone` ramp) around charred logs. Burning: flames rise about 12 px with a `fire4` core. Low (under 30 s of fuel): flames about 6 px plus embers. Windy (cold front): flames lean 2 to 3 px with the wind and throw an extra spark. Anchor at the centre of the ring. Keep the flame design consistent with the favicon (`public/favicon.svg`), which uses the same ramps; if the in-game flame changes noticeably, redraw the favicon to match. |
| Hearth site | 24 × 12 | 1 | Ground decal next to the fire pit: a small stack of fitted stones and a chalk outline. Shown only once the hearth is unlocked and not yet built. |
| Stone hearth | 32 × 28 | `unlit`; `burning` (4); `low` (4); `windy` (4) | Replaces the fire pit when built, at the same anchor. A low, mortared wall of fitted `stone` blocks with a flat front lip and a back wall a few pixels taller, so it reads as built rather than gathered. Same flame frames as the fire pit, 2 px taller. |
| Shelter site | 48 × 32 | 1 | Ground decal: 4 stakes with rope between them on a cleared earth rectangle. No transparency, no box outline. |
| Shelter | 48 × 40 | `built`, `built-bed` | A-frame or lean-to of `canvas` over `wood` poles, open doorway facing down (toward the camera), with poles lashed at the top in `canvas2` fiber cord (shelter and bed both cost fiber). `built-bed` shows a bedroll inside the doorway. |
| Crate site | 16 × 16 | 1 | Ground decal: four corner pegs and a chalk-like `earth4` cross. |
| Crate | 16 × 16 | 1 | Wooden crate, plank lines, top face visible. |
| Drying rack site | 32 × 16 | 1 | Four stakes marking a small frame northeast of the fire. |
| Drying rack | 32 × 32 | 1 | Two upright posts, crossbar, and hanging berry clusters. |
| Windbreak site | 48 × 16 | 1 | A curved row of short stakes southwest of the fire. |
| Windbreak | 48 × 32 | 1 | Short woven timber wall, with the front face and top edge visible. |
| Log seat (decorative) | 24 × 12 | 1 | One or two by the fire. Purely decorative, makes the camp feel lived in. |

### Survivor

| Sprite | Size | Frames | Notes |
|---|---|---|---|
| Survivor | 16 × 24 | `idle-down` (2), `walk-down` (4), `walk-up` (4), `walk-side` (4, flipped for left), `gather` (2), `rest` (2), `cook` (2), `stargaze` (2), `shiver` (2) | Red `coat`, `scarf`, backpack on the back (visible from behind and the side). Big readable head (about 9 px wide). Walk at 8 fps, idle breathes (1 px bob) at 2 fps. Gather is a bend-and-reach, played once per gather. Rest is sitting by the fire. Cook is sitting by the fire holding a stick with 2 berries toward the flames. Stargaze is sitting or lying back, face turned up. Shiver (warmth at or below 20) is a 1 px side-to-side jitter of the idle pose, arms in. Pick direction from the last movement input. |

### Wildlife

Keep all behaviour in `src/scene/ambient.ts` and `src/scene/ambientLife.ts`; only the drawing changes.

| Sprite | Size | Frames | Notes |
|---|---|---|---|
| Bird | 8 × 8 | `idle`, `peck` (2), `hop`, `fly` (2) | Fly at 12 fps. |
| Fox | 24 × 16 | `trot` (4), `run` (4), `sit` (2, tail flick) | Trot at 10 fps, run at 14 fps. Sitting fox is about 12 × 16 within the frame and faces the fire. |
| Firefly | 3 × 3 | `glow` (2) | A `firefly` core pixel plus a dim cross. The light comes from the lighting layer. |

### Effects

| Sprite | Size | Frames | Notes |
|---|---|---|---|
| Gather pop | 8 × 8 icon | rises 8 px over 0.6 s, then vanishes | Shows the wood, berry or fiber icon above the node. |
| Smoke puff | 8 × 8 | 3 | Rises from the fire every 1 to 2 s while burning. Uses `stone3`/`stone4`. |
| Sparks | 1 × 1 | n/a | 1 to 2 `fire4` pixels drifting up from the fire occasionally. |
| Wind streak | 12 × 3 | 3 | Cold front only. A short `frost` streak that stretches, holds and fades as it drifts with the wind. |
| Sleet fleck | 1 × 1 or 2 × 1 | n/a | Cold front only. `frost` pixels falling at a slant, faster than the streaks. |
| Shooting star | 6 × 2 | 3 | Optional. During stargazing, one streak of `paper` crosses the top third of the screen once. In top-down view the sky isn't visible, so this is the only sky cue; keep it rare. |
| Cook steam | 4 × 6 | 3 | A wisp above the berries while the survivor cooks. |
| Morning frost | 16 × 16 | 3 variants | Optional. After a failed cold night, `frost` and `stone4` rime on the grass and earth tiles around camp, fading out over the 30 seconds the game skips into the morning. Presentation only: detect the failed-night transition in the scene, as the outcome message already does, and keep it out of the saved state. |

### UI icons

The HTML sidebar and top bar keep their current layout and fonts. Replace the Unicode symbols (▰ ● ◫ ⌂ ▣ ▤) with pixel icons rendered from the same sprite definitions (exported as data URLs at boot, shown with `image-rendering: pixelated` at 2× or 3×).

| Icon | Size | Notes |
|---|---|---|
| Wood, food, fiber, bag capacity | 16 × 16 | Fiber is a small coiled bundle of reed cord in the `canvas` ramp. |
| Shelter, bed, crate, hearth (build list) | 16 × 16 | |
| Hearth locked state | 16 × 16 | Same hearth icon in `stone1`/`stone2` only, with a small padlock. |
| Forecast card (cold front coming, active, weathered) | 16 × 16 each | Cloud with wind; cloud with sleet; sun over the hearth. |
| Forecast checks (done, not yet) | 8 × 8 each | Replace the text ✓ marks on the shelter and fire checks: a `grass3` tick, and an empty `stone2` circle. |
| Night actions: cook, stargaze | 16 × 16 each | Berries on a stick; a star. |
| Energy, hunger, warmth (meter labels) | 8 × 8 | |

Align the sidebar's accent colors with the palette: energy bar in `grass3`/`grass4`, hunger in `scarf3`/`scarf4`, warmth in `fire2`/`fire3`, wood text in `wood2`, berries in `berry2`, fiber in `canvas2`. The forecast card uses `storm` and `frost` while a front is coming or active, and the `fire` ramp once weathered.

The favicon (`public/favicon.svg`, a 16 × 16 campfire) already follows this spec. Use it as the reference for the fire's look and for icon scale.

## Phases

Each phase is one PR, keeps the game playable, and keeps all existing tests passing.

1. **Pipeline:** palette, sprite format, texture generation, contact sheet page, art tests, pixel-perfect scaling and the 16 px `TILE`. Temporarily show the existing art scaled to the new grid if needed. No new art yet beyond a test sprite or two.
2. **Terrain and map composition:** grass, autotiled camp clearing and paths, decoration, rim stones, trees with y-sorting, forest border and groves.
3. **Nodes and camp:** branch piles, berry bushes, fiber reeds, fire pit, build sites, shelter, bed, crate, hearth site, stone hearth, log seat. Remove halos, dotted circle and translucent ellipses.
4. **Survivor:** directional walk, idle, gather, rest, cook, stargaze and shiver animations.
5. **Wildlife and effects:** birds, fox, fireflies, gather pops, smoke, sparks, cook steam, shooting star, wind streaks, sleet and morning frost.
6. **Lighting and weather:** the time-of-day lighting layer including the cold-front tint, stepped lights, fire radius tied to fuel and hearth, windy flames. Remove the old night rectangle, additive glow and scrolling wind lines.
7. **UI icons and palette alignment** in the HTML interface, including the forecast card and its checks, night actions and the locked hearth.

## Review

### Screenshots for every PR

Take them at 2× (a 960 × 600 canvas) by loading a save into `localStorage` under `hearthwild.save` and pressing **Continue your camp**. In the page, import `createGame` from `/src/game/state.ts` and `saveGame` from `/src/game/save.ts`, adjust the state, and save it with `saveGame(localStorage, state)`. Check it returns `ok: true`: the save validator rejects inconsistent states, for example a built hearth needs `progress.hearthUnlocked` true and `progress.nextStormDay` null, and the bag can't hold more than its capacity. Hand-writing `{ version, state }` JSON breaks whenever the save version changes. Show before and after for:

1. Day, survivor at camp with shelter, bed and crate built and the fire burning.
2. Day, a fresh game: camp with all build sites empty and nodes ready.
3. Meadow away from camp with birds, and ready and depleted branch, berry and fiber nodes.
4. Golden hour (`timeOfDay` 150) with the fox arriving.
5. Night (`timeOfDay` 200) at camp, fire burning, fox sitting, fireflies.
6. Night with the fire out.
7. Cold-front night (`day` 3, `timeOfDay` 190, `progress.nextStormDay` 3) at camp with a shelter and the fire burning.
8. The morning after a failed cold night, if morning frost is implemented: let the fire run out during shot 7's night and capture dawn.
9. Day with the stone hearth built and burning (`structures.hearth` and `progress.hearthUnlocked` true).
10. The survivor cooking and stargazing at camp at night (two shots).
11. The contact sheet page.
12. One of the above at phone width (390 px wide).

Also attach a 4× crop of the area around the survivor in shot 1, to check pixel alignment.

### Acceptance checklist

A phase is done when all of these hold for everything it touched:

- [ ] Every visible pixel sits on the art grid at a whole-number scale: no blur, no half pixels, no mixed pixel sizes (check the 4× crop).
- [ ] Only palette colors appear, apart from `shadow` alpha and the lighting layer.
- [ ] **Grayscale test:** in a grayscale copy of shots 1 and 3, the survivor, ready vs depleted nodes, the fire state and each structure are still distinguishable.
- [ ] **Squint test:** blurred or viewed small, the eye goes first to the survivor, then the fire and camp, then nodes; decoration and trees recede.
- [ ] Light comes from the top-left on every sprite; every shadow points the same way.
- [ ] Outlines follow the rule (own ramp's darkest color, 1 px, may break on the lit edge).
- [ ] No pillow shading, banding, jaggies or orphan pixels in the contact sheet at 4×.
- [ ] Ready vs depleted is readable without any halo or glow.
- [ ] Y-sorting is right: the survivor passes behind trees and the shelter from above and in front from below.
- [ ] At night the fire is the brightest, warmest thing on screen and the camp is readable, including on a cold-front night.
- [ ] Cold-front weather moves with the world, sits on the art grid, and doesn't hide the survivor or the fire.
- [ ] No gameplay change: all existing tests pass, and node and camp positions are unchanged.
- [ ] Frame time is no worse than before at 2× (draw static terrain once into a texture rather than per frame).

## Out of scope

- Gameplay, balance, save format, and positions of nodes and camp sites.
- Collision with trees or rocks.
- Sound.
- New areas, seasons, or weather beyond the existing cold front. Any future weather should reuse this palette, the lighting layer and the wind and sleet sprites.
- Replacing the HTML UI with an in-canvas pixel UI.

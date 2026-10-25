# Quarry Area Design

## Intent

The supplies rework made stone heavy and finite: rocks give stone once and never refill. This project gives stone a lasting source, and gives the game its first place beyond the camp map. Once the shelter is built, a new path leads out of camp to the map edge. Walking off the end of it takes the survivor into a second area: rockier and more open, with a quarry in it.

The quarry always offers a little loose rubble, which can be gathered by hand. A pickaxe, made at a new **toolshed**, lets the survivor dig the quarry for a stone every day. Because stone always comes back, the camp map can lose half its rocks without any risk of a soft lock.

This builds on the supplies rework (PR #63, merged) and assumes its rules: stone takes 2 bag spaces, loose stone piles, the camp stone pile, and builds that draw on bag stone plus pile stone.

## Goals

- A second area reached by walking off the edge of the map at the end of a new path. The path opens once the shelter is built.
- A quarry in that area. Hand-gathered rubble is always eventually available there, and with a pickaxe the quarry gives 1 stone a day.
- A toolshed at camp, where every tool is made, including the stone axe.
- Fewer rocks at camp (3 instead of 6), with no way to make the game unwinnable.

## Non-goals

- New uses for stone. With the quarry, stone simply stops being finite. Anything that spends it is a later project.
- Anything in the second area besides the quarry, its rubble, and the way back.
- More areas, or a world map.
- Migrating old saves. Older versions are rejected, as with version 11.

## Anti-goals

- **A soft lock.** No order of spending can leave the player unable to get stone again.
- Clutter on the camp map. The new path isn't drawn until it opens.
- A trip to the quarry that feels like a loading screen or a menu. Walking off the edge should feel like walking on.
- The toolshed or pickaxe becoming a chore. They're one-time builds.

## Rules

### The new path and the second area

- **Before the shelter:** the new path doesn't exist on the map, either as art or as a target.
- **Once the shelter is built:** a fifth path appears, running from the camp circle to one map edge. Today's four paths run diagonally to the corners. This one leaves from a free side, such as straight west or straight south (the builder chooses).
- **Crossing over:** walking off the map edge where the path meets it puts the survivor into the second area, at the matching edge where its own path begins. Walking back off that edge returns them to the end of the camp path. Only the path's end works as a crossing; the rest of each edge stays a wall, as today.
- **Tap and walk:** tapping beyond the path's end should still let the survivor cross. For example, a tap target at the path's end makes walking there and stepping across one action.
- **The second area itself:**
  - The same tile size and map size as camp (40×30).
  - **Rockier and more open:** more bare ground and stone decals, and few trees.
  - Its path leads from the crossing to the quarry.
- **Everything else keeps running there:** the clock, hunger, warmth, energy, night, weather, and the cold-front schedule. The fire stays at camp, so being away costs warmth just as any trip away from camp does today. Camp actions such as feeding the fire, sleeping, building, and the stone pile only work in the camp area.
- **Dropped stone stays in the area where it was dropped.** Loose piles belong to an area.

### Night at the quarry: glowing eyes (decided)

Night in the second area is **spooky but safe**.
- After dark, pairs of glowing eyes appear here and there at the edge of the darkness, blink, and fade.
- When the survivor walks toward a pair, it backs off and fades before they get close. My call: a pair vanishes inside about 4 tiles.
- They never chase, block, or harm the survivor, and they have no effect on hunger, warmth, energy, or any rule. They're purely visual.
- They live in the ambient-wildlife layer (`AmbientLife`, alongside the birds, fox, and fireflies), not in the game rules or the save.
- My call: only a few pairs show at once, they never appear at camp, and the two eye pixels glow above the night overlay, as fireflies do.

### Finding the quarry

- The first time the survivor comes within reach of the quarry (the usual 2-tile interaction radius), it counts as found. A message marks it, and the pickaxe appears in the build list.
- The field journal adds the new path and the quarry, following today's pattern. The place stays unnamed until it's found, and finding it counts as a milestone.

### Rubble (by hand, no tool)

- Loose rubble at the quarry gives **1 stone** with E or a tap. It needs 2 free bag spaces and works like gathering any other node.
- It's ready on the first visit. After it's gathered, it refills **3 dawns later**, the same way a tree regrows from a stump.
- This is what makes the game impossible to soft-lock: however the player has spent their stone, more always comes back eventually.

### The toolshed

- A new build under Little improvements.
- Costs **5 wood and 2 fiber**. It requires the shelter, the same as the bed.
- It's built like other structures, inside the camp circle, and adds a visible structure at its own spot in camp.
- **Every tool is made at the toolshed.** Making one needs the toolshed to be built and the survivor to be at camp. The toolshed doesn't open a separate menu: the tool panels gain the toolshed as a requirement.

### Tools

- **Stone axe:** needs the toolshed **and** a weathered cold night, as it does today. The cost is unchanged: 1 wood, 1 fiber, 1 stone. Its panel says what's still missing, for example "Build a toolshed first".
- **Pickaxe:** needs the toolshed **and** the quarry found. It does **not** need the axe. It costs **2 wood, 1 fiber, 2 stone**: the fiber is lashing, and the heavier head takes 2 stone. Like other stone costs, the stone can come from the bag or the camp stone pile. It's crafted the same way as the axe, with its own panel or entry next to the axe.

### Digging the quarry (with the pickaxe)

- Standing at the quarry with the pickaxe, the survivor can dig with E, a tap, or the prompt. It takes about **10 seconds and 8 energy**, like chopping a tree, and gives **1 stone**. It needs 2 free bag spaces.
- After that, the quarry is spent until the **next dawn** and visibly shows it, the way a stump does. On a day when both are ready, digging and picking up rubble are separate actions, so the player gets 2 stone that day.
- **Without the pickaxe:** the prompt says a pickaxe is needed, the same way a mature tree says it needs an axe.

### Stone balance

- **Camp rocks drop from 6 to 3.** With the cairn's 2, that's 5 stone before the quarry.
- **Stone needs:** hearth 3, axe 1, lookout 2 and pickaxe 2, which is 8 in total. Some of it has to come from the quarry. That's intended and safe:
  - The quarry opens with the shelter, before the hearth unlocks (after the day 3 cold night).
  - Rubble always returns.
- **Critical path:**
  - Shelter by day 3: needs no stone.
  - The cold night: needs no stone.
  - Then the hearth, the toolshed, the axe, the pickaxe and the lookout in any order. The quarry covers any shortfall.
- The cold-front forecast and early hints mustn't suggest the player needs stone before the cold night.

## Save

- Bump `SAVE_VERSION` to 12. Earlier versions show the existing "could not be loaded" message, and the player starts fresh.
- Persist:
  - Which area the survivor is in, along with their position.
  - Loose stone piles, tagged by area.
  - The toolshed.
  - Whether the quarry has been found.
  - Whether the pickaxe has been crafted.
  - The quarry's next ready day.
  - The rubble's next ready day.
  - The reduced rocks.
- The README's rule of one open save-format PR at a time applies. PR #63 (version 11) has merged; take the next unused number at merge time.

## Constraints

- Keep the rules pure in `src/game/` with Vitest coverage, following existing patterns (`applyAction`, `BALANCE`, `buildStatus`, the `ResourceNode` / `TreeNode` style, `readyDay`).
- **The terrain is currently drawn once, when the scene starts** (`drawTerrain` and `src/scene/map.ts`). Both the new path opening and the area change need the terrain to redraw, or to keep one layer per area.
- Keep the phone layout and tap controls working. Bag and build buttons are at least 44 px tall on phones, and the new targets work with `pickTapTarget` and `closestGatherable`.
- Pixel art follows `docs/superpowers/specs/2026-10-21-pixel-art-direction.md`. The new art is:
  - the quarry, ready and spent
  - rubble, ready and gathered
  - the toolshed, its build site, and the built toolshed
  - the pickaxe icon
  - the second area's rocky ground
  - the glowing eyes
- Text contrast meets WCAG AA (4.5:1).
- `npm run lint`, `npm test -- --run`, and `npm run build` pass. Update the README's play, building, places, and saving sections.

## Verification

- **Unit tests:**
  - The path is closed before the shelter and open after it.
  - Crossing at the path's end changes area and position, and anywhere else the edge still blocks.
  - Camp actions are refused in the quarry area.
  - The quarry counts as found once within reach.
  - Rubble gives 1 stone, needs 2 spaces, and refills after 3 dawns.
  - The toolshed's cost and its shelter prerequisite.
  - The axe needs the toolshed and the cold night. The pickaxe needs the toolshed and the quarry found, but not the axe. Both pay stone through the pile.
  - Digging needs the pickaxe and gives 1 stone once per day.
  - Piles stay in their area.
  - Version 12 round-trips, and older versions are rejected.
  - Ambient timing: eyes only at night, only in the quarry area, and a pair within about 4 tiles of the survivor fades out.
  - Soft-lock check: from a state with 0 stone anywhere, the shelter built and the quarry found, repeated dawns plus rubble eventually afford the pickaxe.
- **Browser check (desktop and a 390×844 phone):**
  - Build the shelter and watch the path appear.
  - Walk off its end into the quarry area and back.
  - Find the quarry, pick up rubble, build the toolshed, and craft the pickaxe.
  - Dig, and see the quarry spent until dawn.
  - Reload while in the quarry area and continue there.
  - At night in the quarry area, glowing eyes appear and back away when approached. None appear at camp.

## Calls made in review (my calls)

- "At camp" means the camp area *and* within the camp radius. Sites, the lookout, sleep, building, crafting, the stone pile and weathering the cold front all need the camp area.
- The pickaxe stays hidden until the quarry is found and then shows in the tools panel. The axe keeps its "Unlocks after the cold front" text until the cold night is weathered.
- Journal: add hints for the toolshed and the quarry, and update the closing line from four paths to five. The quarry is listed at the end of the new path, because the camp map can't show the second area.
- Night in the quarry area: ordinary darkness with no fire glow, with the survivor kept visible.
- The soft-lock test builds the toolshed in its setup. The toolshed costs no stone, so this doesn't change what the test proves.
- Rubble and the quarry face sit on separate tiles, so taps and E choose between them clearly.

## Left to the builder

- Which side of the map the new path leaves from, and the second area's layout.
- Which 3 rocks stay at camp. Keep one reasonably close to camp.
- Where the toolshed goes in camp, and all the new art.
- How crossing looks: an instant switch, or a brief fade.
- Whether the camera snaps at the crossing.
- Where the pickaxe lives in the UI: its own panel, or the axe panel turned into a "Tools" panel.
- Exact copy for messages, prompts, the journal, and hints.
- How the save tags piles by area.

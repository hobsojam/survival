# Hearthwild

A small, single-player browser survival game about making a wilderness camp feel like home. You control one survivor, gather branches, berries, and fiber, keep a fire burning, and build a shelter, bed, storage crate, drying rack, windbreak, stone pile, toolshed, and eventually a stone hearth. Beyond camp, a west path leads to a second area with an old quarry. Survival is gentle: cold and hunger slow you down, but they never end the game.

**Play it online:** <https://hobsojam.github.io/survival/>. Every merge to `main` redeploys it.

## Run it

Requires npm and Node.js 24 (recommended). The installed toolchain also supports Node.js 22.12+ or 26+.

```bash
npm ci
npm run dev
```

Open the local address printed by Vite, usually <http://localhost:5173/>. For a production bundle, run `npm run build`; the output is in `dist/` and should be served by a static web server. During sprite development, open `/sprites.html` on the same local server to see every registered sprite frame at 4× on grass, camp earth, and night backgrounds. The contact sheet is not included in the production build.

## How to play

| Control | Action |
| --- | --- |
| WASD or arrow keys | Move the survivor |
| E | Gather the nearest branches, berries, fiber plants, rocks, loose stone, or quarry rubble within reach, or dig the quarry face with the pickaxe; at camp with nothing nearby, rest |
| F | Add one wood to the campfire while at camp |
| R | Rest at camp for a short break |
| Z | Sleep until morning (at night, at camp, once the shelter is built) |
| Q | Eat one carried food |
| C | Cook one berry at a lit campfire after dark |
| G | Watch the stars at camp after dark |
| P | Dry one berry into a trail ration at a built drying rack |
| T | Eat one trail ration, anywhere |
| X | Chop the nearest mature tree (once you have the stone axe) |
| V | Explore the nearest place along the paths |
| L | Repair the old lookout when you stand beside it |
| Walk off the west edge | Follow the west path into the quarry area, once the shelter is built; walk off the quarry's east edge to come home |
| Tap or click | Walk there, or walk over and use the supply, loose stone, tree, place, lookout, campfire, rubble, quarry face, or path end you tapped |
| Build buttons | Spend wood, and sometimes fiber or stone, on camp upgrades and tools |
| Bag buttons | Eat a berry or ration, burn wood or fiber at camp, or drop a stone where you stand |
| Store 1 / Take 1 | Move stone between your bag and a built stone pile, at camp |

The buttons beside the game also let you eat, rest, feed the fire, and sleep. If the keyboard does not respond, click the game area once to focus it.

You can also tap or click to play. Tap the ground to walk there. Tap a supply, a loose stone, a mature tree, a place along the paths, the lookout, or the campfire, and the survivor walks over and uses it once: gathering, chopping, exploring, repairing, or adding a log. On a phone held upright, the game fills the screen. Eat, Rest, Fire, and Sleep sit in a row at the bottom (with Cook and Stars at night when they are ready), and the Bag, Build, and Camp tabs slide up the rest of the panels. Tap the game or the tab again to close them. A dot on Build means something is ready to build or craft.

At night, the **After dark** panel offers two optional ways to spend a little time. Cook one berry at a lit campfire for a warmer, more filling meal; it takes eight seconds and restores 35 hunger and 10 warmth, in addition to the warmth you gain while near the fire. A drying rack raises the meal's hunger recovery to 50. Or watch the stars at camp for twelve seconds and regain 10 energy. The panel shows when each activity is ready. Neither activity is needed for survival, and you can still rest or sleep as before.

A day lasts four minutes: morning and afternoon take two minutes and forty seconds, then night lasts eighty seconds until dawn. The dial in the top bar shows where you are in the day, with night shaded, and counts down to nightfall or dawn. Gathering takes six seconds and building takes twelve seconds, so daylight matters.

You tire slowly while awake, losing about one energy every six seconds you spend walking or idle; gathering and building cost their own energy instead. A rest at camp takes twenty seconds and restores 25 energy, or 50 with a bed. Once night falls and you have a shelter, you can sleep at camp until morning: the night still passes, so hunger falls and the fire burns down, but you wake with 60 more energy, or fully rested in a bed. Feed the fire before bed if you want to wake up warm. Cold is stronger outside at night. The fire provides warmth for 90 seconds per wood, and a shelter reduces cold exposure at camp. Hunger falls over time. Low energy, hunger, or warmth slows movement, but you can always move and gather supplies. Branches, berries, fiber plants, and rocks replenish at dawn.

Your bag holds eight spaces at first. To build, stand anywhere inside the marked circle around the campfire and click an upgrade in the “Little improvements” panel. Shelter costs six wood and two fiber; bed costs four wood and one fiber after shelter; storage crate costs four wood. Wood, food, fiber, and trail rations take one space each, but **stone is heavy and takes two**, so the bag's Carried count shows spaces used. Gather the pale seed heads for fiber and collect stone from the three rocks in camp, then choose what to carry home. Branches, berries, and fiber come back at dawn, but each rock gives **one stone, once**, and then stays as pebbles. Stone never runs out for good, though: the quarry beyond the west path always gives more (see **Beyond camp**). Every supply in the bag has a button that suits it: **Eat** a berry or a ration, **Burn** wood (the same as feeding the fire) or fiber (30 seconds of kindling) while at camp, or **Drop** a stone. A dropped stone stays on the ground where you stood, joining any loose pile within a tile, and you can pick it back up (E or a tap) when you have two free spaces. The bed improves resting; the crate raises carrying capacity to sixteen. A drying rack costs four wood, makes cooked berries more filling, and lets you prepare trail rations. A windbreak costs five wood and halves warmth loss at camp on unlit nights, including cold fronts. A **stone pile** costs three wood and keeps up to twelve stone at camp outside your bag; use **Store 1** and **Take 1** beside it in the build list. A **toolshed** costs five wood and two fiber after the shelter; every tool is made there. The hearth, the stone axe, the pickaxe, and the lookout repair can all use stone from the pile as well as from your bag, spending bag stone first. All of these add visible structures to camp. The game has two fixed areas, camp and the quarry, and no combat or companions yet.

### The cold night

The forecast card warns you about a cold front on **day 3 night**. Build a shelter and keep the fire burning through dawn while you stay at camp. The front burns fire fuel twice as fast, so two fresh logs at nightfall will last the full night. The card shows your shelter status and how much fuel is needed. Sleeping passes the night, but the fire still burns and the cold-night outcome still applies.

If you weather it with warmth above 20, you unlock the **stone hearth**. Build it for two wood and three stone to make each future log burn for 150 seconds instead of 90. If the camp is unprepared, you wake tired and lose 30 seconds of the morning; another cold front arrives three days later. You can always recover, gather more wood, and try again.

Weathering the cold front also teaches you to make a **stone axe**. Once the toolshed is built, craft it at camp from the **Forest tools** panel for one wood, one fiber, and one stone; until then the panel says "Build a toolshed first." Then stand near a mature tree and press **X** (or tap the tree) to chop it: it takes ten seconds and eight energy and gives two wood, leaving a stump that regrows after three dawns. Fallen branches stay easy to gather without the axe.

### Trail rations

Once the drying rack is built, you can dry one berry at camp into a **trail ration** (P, or **Prepare trail ration** in the sidebar); it takes twelve seconds. Eat a ration anywhere with T to restore 45 hunger, which makes longer trips along the paths easier. Rations count toward your bag like any other supply.

### Beyond camp

Four paths lead out of the clearing from the start, and a fifth, the west path, opens once the shelter is built. Three of them end at places to explore within two tiles of their marker: an **old basket** that holds two berries once, a **stone cairn** that gives two stone once, and a **quiet spring** where you can always stop for a twenty-second rest that restores 20 energy. The basket needs two free bag spaces and the cairn's two heavy stones need four; if your bag is too full, the find waits for you. Press V, tap the place, or use **Explore nearby place**.

The fourth path leads northeast to a damaged **lookout**. After you weather the cold front, bring four wood and two fiber and repair it while standing beside it (L, the sidebar button, or a tap). The two stone can come from your bag or the camp stone pile. It takes twelve seconds and six energy. A short closing scene celebrates the restored view, and then you can keep playing freely.

The pale frames in camp mark future building sites. Branch piles, berry bushes, fiber plants, and rocks show when they are ready to gather; they fade after collection (rocks leave pebbles) and replenish at dawn. The scene art is drawn in Phaser, so there are no external image assets to install.

The **field journal** in the sidebar shows the paths from camp and your position on a small map. Places keep their names hidden until you visit them, while the lookout stays marked from the start. Once the shelter is built, the west path joins the map, with the quarry marked at its end; while you are in the quarry area, your marker waits there. The journal also records shelter, cold front, quarry, and lookout milestones and suggests a next step, such as building the toolshed after the cold front. It reads your existing save progress, so returning camps show their discoveries immediately.

The wilderness has a little life of its own. Birds peck in the meadows and flutter off if you come too close or when night falls. On most evenings a fox visits the edge of camp and sits by the fire until well after dark, unless you walk up to it. Fireflies drift around camp at night. None of this affects survival or the save.

### The west path and the quarry

Once the shelter is built, a fifth path opens toward the camp's west edge. Walk off the edge at the end of the path (or tap the path's end) and you arrive in a second area: rockier and more open, with few trees. Walk off its east edge to come home. The clock, hunger, warmth, energy, weather, and the cold-front schedule keep running there, but the fire stays at camp, and feeding it, sleeping, building, crafting, and the stone pile only work back in the camp area. Stone you drop stays in the area where you dropped it. If you save and come back while you are in the quarry area, you continue there.

Walk close to the **old quarry** to find it. Beside it lies a heap of loose **rubble**: pick a stone from it by hand (E or a tap) when you have two free bag spaces, and it loosens again three dawns later. Finding the quarry adds a **pickaxe** to the Forest tools panel. Craft it at camp with the toolshed built, for two wood, one fiber, and two stone; it does not need the axe. Then stand at the quarry face and dig (E, a tap, or the prompt). Digging takes ten seconds and eight energy and gives one stone, and the face shows as spent until the next dawn. On a day when both are ready, the rubble and the dig together give two stone. However you spend your stone, more always comes back.

At night, pairs of glowing eyes watch from the dark edges of the quarry area. They blink, back away, and vanish as you approach. They are only a look: nothing follows you, and they never harm you.

## Saving

Progress is saved in this browser's local storage under `hearthwild.save` after successful actions, periodically, and when the page is hidden or closed. Choose **Continue your camp** when you return. **Start a new game** asks before replacing an existing save. Only saves in the current format (version 12) load. A save from an earlier version shows a message that it could not be loaded, and you start a fresh camp. Loose stone piles (with the area they are in), the stone pile and its stored stone, spent rocks, the area you are in, the toolshed, the pickaxe, and when the quarry and rubble are ready again are all saved. Saves stay in this browser profile; private browsing, clearing site data, or switching devices will not carry them over. The game shows a message if storage fails or an existing save cannot be read. If saving keeps failing, the game says so once, then retries quietly after 10, 30 and 60 seconds while the status reads **Save failed · retrying**.

### Changing the save format

Only one open PR may change the save format (`SAVE_VERSION`, the saved shape, or a migration) at a time. Before merging, rebase it on `main` and take the next unused version number, so two branches never ship different shapes under the same version.

## Verify

```bash
npm run lint
npm test -- --run
npm run build
```

`npm test` runs the suites in `tests/`. Agent worktrees under `.superpowers/` are excluded. The tests cover game state, renewable fiber, mixed-material building, gathering, day/night survival, tiredness and sleep, optional night activities, the clock, camp upgrades, cold-night progression and the storm forecast, the stone axe and tree regrowth, the west crossing and the quarry area, rubble, the toolshed, the pickaxe and digging, the night eyes, trail rations, path discoveries, the lookout, the field journal, heavy and loose stone, the stone pile, save validation, tap targets and walking, the phone dock and canvas scaling, and ambient wildlife timing. A browser playthrough should also check movement, tapping, building, fire, weather visuals, crossing to the quarry and back, and continuing after a reload (in either area), both at desktop size and on a phone held upright.

`npm test -- --run --coverage` also writes a coverage report to `coverage/`. CI runs it that way and then sends the code and the coverage report to [SonarCloud](https://sonarcloud.io/project/overview?id=hobsojam_survival), configured in `sonar-project.properties`. The scan needs a `SONAR_TOKEN` repository secret. Dependabot pull requests are never scanned, and pull requests from forks skip the scan because they don't receive the secret.

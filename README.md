# Hearthwild

A small, single-player browser survival game about making a wilderness camp feel like home. You control one survivor, gather branches, berries, and fiber, keep a fire burning, and build a shelter, bed, storage crate, drying rack, windbreak, and eventually a stone hearth. Survival is gentle: cold and hunger slow you down, but they never end the game.

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
| E | Gather the nearest branches, berries, fiber plants, or rocks within reach; at camp with nothing nearby, rest |
| F | Add one wood to the campfire while at camp |
| R | Rest at camp for a short break |
| Z | Sleep until morning (at night, at camp, once the shelter is built) |
| Q | Eat one carried food |
| C | Cook one berry at a lit campfire after dark |
| G | Watch the stars at camp after dark |
| Build buttons | Spend wood, and sometimes fiber or stone, on camp upgrades |
| Drop 1 buttons | Drop one carried item to make room in a full bag |

The buttons beside the game also let you eat, rest, feed the fire, and sleep. If the keyboard does not respond, click the game area once to focus it.

At night, the **After dark** panel offers two optional ways to spend a little time. Cook one berry at a lit campfire for a warmer, more filling meal; it takes eight seconds and restores 35 hunger and 10 warmth, in addition to the warmth you gain while near the fire. A drying rack raises the meal's hunger recovery to 50. Or watch the stars at camp for twelve seconds and regain 10 energy. The panel shows when each activity is ready. Neither activity is needed for survival, and you can still rest or sleep as before.

A day lasts four minutes: morning and afternoon take two minutes and forty seconds, then night lasts eighty seconds until dawn. The dial in the top bar shows where you are in the day, with night shaded, and counts down to nightfall or dawn. Gathering takes six seconds and building takes twelve seconds, so daylight matters.

You tire slowly while awake, losing about one energy every six seconds you spend walking or idle; gathering and building cost their own energy instead. A rest at camp takes twenty seconds and restores 25 energy, or 50 with a bed. Once night falls and you have a shelter, you can sleep at camp until morning: the night still passes, so hunger falls and the fire burns down, but you wake with 60 more energy, or fully rested in a bed. Feed the fire before bed if you want to wake up warm. Cold is stronger outside at night. The fire provides warmth for 90 seconds per wood, and a shelter reduces cold exposure at camp. Hunger falls over time. Low energy, hunger, or warmth slows movement, but you can always move and gather supplies. Branches, berries, fiber plants, and rocks replenish at dawn.

Your bag holds eight supplies at first. To build, stand anywhere inside the marked circle around the campfire and click an upgrade in the “Little improvements” panel. Shelter costs six wood and two fiber; bed costs four wood and one fiber after shelter; storage crate costs four wood. Your bag holds wood, food, fiber, and stone toward the same capacity. Gather the pale seed heads for fiber and collect stone from rocks, then choose what to carry home. If the bag is full, use **Drop 1** beside a supply to make room; nothing is lost for good, because everything you gather replenishes at dawn. The bed improves resting; the crate raises carrying capacity to sixteen. A drying rack costs four wood and makes cooked berries more filling. A windbreak costs five wood and halves warmth loss at camp on unlit nights, including cold fronts. Both add visible structures to camp. The game has one fixed map and no combat or companions yet.

### The cold night

The forecast card warns you about a cold front on **day 3 night**. Build a shelter and keep the fire burning through dawn while you stay at camp. The front burns fire fuel twice as fast, so two fresh logs at nightfall will last the full night. The card shows your shelter status and how much fuel is needed. Sleeping passes the night, but the fire still burns and the cold-night outcome still applies.

If you weather it with warmth above 20, you unlock the **stone hearth**. Build it for two wood and three stone to make each future log burn for 150 seconds instead of 90. If the camp is unprepared, you wake tired and lose 30 seconds of the morning; another cold front arrives three days later. You can always recover, gather more wood, and try again.

The pale frames in camp mark future building sites. Branch piles, berry bushes, fiber plants, and rocks show when they are ready to gather; they fade after collection (rocks leave pebbles) and replenish at dawn. The scene art is drawn in Phaser, so there are no external image assets to install.

The **field journal** in the sidebar shows the four paths from camp and your position on a small map. Places keep their names hidden until you visit them, while the lookout stays marked from the start. The journal also records shelter, cold front, and lookout milestones and suggests a next step. It reads your existing save progress, so returning camps show their discoveries immediately.

The wilderness has a little life of its own. Birds peck in the meadows and flutter off if you come too close or when night falls. On most evenings a fox visits the edge of camp and sits by the fire until well after dark, unless you walk up to it. Fireflies drift around camp at night. None of this affects survival or the save.

## Saving

Progress is saved in this browser's local storage under `hearthwild.save` after successful actions, periodically, and when the page is hidden or closed. Choose **Continue your camp** when you return. **Start a new game** asks before replacing an existing save. Saves from earlier versions (1 to 5) load with their supplies and camp intact; missing fiber plants, rocks, and structures are added, and branch piles move to their current spots near the trees. Version 1 camps also gain a future cold front with at least two days of warning. Saves stay in this browser profile; private browsing, clearing site data, or switching devices will not carry them over. The game shows a message if storage fails or an existing save cannot be read. If saving keeps failing, the game says so once, then retries quietly after 10, 30 and 60 seconds while the status reads **Save failed · retrying**.

### Changing the save format

Only one open PR may change the save format (`SAVE_VERSION`, the saved shape, or a migration) at a time. Before merging, rebase it on `main` and take the next unused version number, so two branches never ship different shapes under the same version.

## Verify

```bash
npm run lint
npm test -- --run
npm run build
```

The tests cover game state, renewable fiber, mixed-material building, save migration, gathering, day/night survival, tiredness and sleep, optional night activities, the clock, camp upgrades, cold-night progression, save migration, and ambient wildlife timing. A browser playthrough should also check movement, building, fire, weather visuals, and continue after reloading.

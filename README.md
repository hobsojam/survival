# Hearthwild

A small, single-player browser survival game about making a wilderness camp feel like home. You control one survivor, gather branches, berries, and fiber, keep a fire burning, and build a shelter, bed, storage crate, and eventually a stone hearth. Survival is gentle: cold and hunger slow you down, but they never end the game.

**Play it online:** <https://hobsojam.github.io/survival/>. Every merge to `main` redeploys it.

## Run it

Requires npm and Node.js 24 (recommended). The installed toolchain also supports Node.js 22.12+ or 26+.

```bash
npm ci
npm run dev
```

Open the local address printed by Vite, usually <http://localhost:5173/>. For a production bundle, run `npm run build`; the output is in `dist/` and should be served by a static web server.

## How to play

| Control | Action |
| --- | --- |
| WASD or arrow keys | Move the survivor |
| E | Gather the nearest branches, berries, or fiber plants within reach |
| F | Add one wood to the campfire while at camp |
| R | Rest at camp for a short break |
| Z | Sleep until morning (at night, at camp, once the shelter is built) |
| Q | Eat one carried food |
| C | Cook one berry at a lit campfire after dark |
| G | Watch the stars at camp after dark |
| Build buttons | Spend wood and sometimes fiber on camp upgrades |

The buttons beside the game also let you eat, rest, feed the fire, and sleep. If the keyboard does not respond, click the game area once to focus it.

At night, the **After dark** panel offers two optional ways to spend a little time. Cook one berry at a lit campfire for a warmer, more filling meal; it takes eight seconds and restores 35 hunger and 10 warmth, in addition to the warmth you gain while near the fire. Or watch the stars at camp for twelve seconds and regain 10 energy. The panel shows when each activity is ready. Neither activity is needed for survival, and you can still rest or sleep as before.

A day lasts four minutes: morning and afternoon take two minutes and forty seconds, then night lasts eighty seconds until dawn. The dial in the top bar shows where you are in the day, with night shaded, and counts down to nightfall or dawn. Gathering takes six seconds and building takes twelve seconds, so daylight matters.

You tire slowly while awake, losing about one energy every six seconds you spend walking or idle; gathering and building cost their own energy instead. A rest at camp takes twenty seconds and restores 25 energy, or 50 with a bed. Once night falls and you have a shelter, you can sleep at camp until morning: the night still passes, so hunger falls and the fire burns down, but you wake with 60 more energy, or fully rested in a bed. Feed the fire before bed if you want to wake up warm. Cold is stronger outside at night. The fire provides warmth for 90 seconds per wood, and a shelter reduces cold exposure at camp. Hunger falls over time. Low energy, hunger, or warmth slows movement, but you can always move and gather supplies. Branches, berries, and fiber plants replenish at dawn.

Your bag holds eight supplies at first. To build, stand anywhere inside the marked circle around the campfire and click an upgrade in the “Little improvements” panel. Shelter costs six wood and two fiber; bed costs four wood and one fiber after shelter; storage crate costs four wood. Your bag holds wood, food, and fiber toward the same capacity. Gather the pale seed heads for fiber, then choose what to carry home. The bed improves resting; the crate raises carrying capacity to sixteen. The game has one fixed map and no combat or companions yet.

### The cold night

The forecast card warns you about a cold front on **day 3 night**. Build a shelter and keep the fire burning through dawn while you stay at camp. The front burns fire fuel twice as fast, so two fresh logs at nightfall will last the full night. The card shows your shelter status and how much fuel is needed. Sleeping passes the night, but the fire still burns and the cold-night outcome still applies.

If you weather it with warmth above 20, you unlock the **stone hearth**. Build it for four wood to make each future log burn for 150 seconds instead of 90. If the camp is unprepared, you wake tired and lose 30 seconds of the morning; another cold front arrives three days later. You can always recover, gather more wood, and try again.

The pale frames in camp mark future building sites. Branch piles, berry bushes, and fiber plants show when they are ready to gather; they fade after collection and replenish at dawn. The scene art is drawn in Phaser, so there are no external image assets to install.

The wilderness has a little life of its own. Birds peck in the meadows and flutter off if you come too close or when night falls. On most evenings a fox visits the edge of camp and sits by the fire until well after dark, unless you walk up to it. Fireflies drift around camp at night. None of this affects survival or the save.

## Saving

Progress is saved in this browser's local storage under `hearthwild.save` after successful actions, periodically, and when the page is hidden or closed. Choose **Continue your camp** when you return. **Start a new game** asks before replacing an existing save. Existing version 1 and 2 saves load with their supplies and camp intact; fiber plants are added to the map. Version 1 camps also gain a future cold front with at least two days of warning. Saves stay in this browser profile; private browsing, clearing site data, or switching devices will not carry them over. The game shows a message if storage fails or an existing save cannot be read.

## Verify

```bash
npm test -- --run
npm run build
```

The tests cover game state, renewable fiber, mixed-material building, save migration, gathering, day/night survival, tiredness and sleep, optional night activities, the clock, camp upgrades, cold-night progression, save migration, and ambient wildlife timing. A browser playthrough should also check movement, building, fire, weather visuals, and continue after reloading.

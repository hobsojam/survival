# Hearthwild

A small, single-player browser survival game about making a wilderness camp feel like home. You control one survivor, gather branches and berries, keep a fire burning, and build a shelter, bed, and storage crate. Survival is gentle: cold and hunger slow you down, but they never end the game.

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
| E | Gather the nearest branches or berries within reach |
| F | Add one wood to the campfire while at camp |
| R | Rest at camp |
| Q | Eat one carried food |
| Build buttons | Spend wood on camp upgrades |

The buttons beside the game also let you eat, rest, and feed the fire. If the keyboard does not respond, click the game area once to focus it.

A day lasts four minutes; night begins after two minutes and forty seconds. Gathering takes six seconds and building takes twelve seconds, so daylight matters. Cold is stronger outside at night. The fire provides warmth for 90 seconds per wood, and a shelter reduces cold exposure at camp. Hunger falls over time. Low energy, hunger, or warmth slows movement, but you can always move and gather supplies. Branches and berries replenish at dawn.

Your bag holds eight supplies at first. To build, stand anywhere inside the marked circle around the campfire and click an upgrade in the “Little improvements” panel. Shelter costs six wood, bed costs four wood after shelter, and storage crate costs four wood. The bed improves resting; the crate raises carrying capacity to sixteen. The game has one fixed map and no combat or companions yet.

The pale frames in camp mark future building sites. Branch piles and berry bushes are brighter when ready to gather; they fade after collection and replenish at dawn. The scene art is drawn in Phaser, so there are no external image assets to install.

## Saving

Progress is saved in this browser's local storage under `hearthwild.save` after successful actions, periodically, and when the page is hidden or closed. Choose **Continue your camp** when you return. **Start a new game** asks before replacing an existing save. Saves stay in this browser profile; private browsing, clearing site data, or switching devices will not carry them over. The game shows a message if storage fails or an existing save cannot be read.

## Verify

```bash
npm test -- --run
npm run build
```

The tests cover game state, gathering, day/night survival, camp upgrades, and save validation. A browser playthrough should also check movement, building, fire, day/night visuals, and continue after reloading.

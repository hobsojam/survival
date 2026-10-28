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
| O | Leave a small offering for a wild animal, when one would take it |
| Walk off the west edge | Follow the west path into the quarry area, once the shelter is built; walk off the quarry's east edge to come home |
| Tap or click | Walk there, or walk over and use the supply, loose stone, tree, place, lookout, campfire, rubble, quarry face, or path end you tapped |
| Build buttons | Spend wood, and sometimes fiber or stone, on camp upgrades and tools |
| Bag buttons | Eat a berry or ration, burn wood or fiber at camp, or drop a stone where you stand |
| Store 1 / Take 1 | Move stone between your bag and a built stone pile, at camp |

The buttons beside the game also let you eat, rest, feed the fire, and sleep. Your survivor's meters and those buttons stay at the top of the sidebar; below them, the **Bag**, **Build**, and **Camp** tabs each show one group of panels, and the sidebar remembers the tab you had open. A dot on Build means something there is ready. If the keyboard does not respond, click the game area once to focus it.

Press **Esc**, or the **Pause** button at the top, to pause. The clock, the fire, hunger, and the sounds all wait until you resume (Esc again, or **Resume** on the card over the game), and the game saves when you pause. The game also holds still while its browser tab is hidden.

You can also tap or click to play. Tap the ground to walk there. Tap a supply, a loose stone, a mature tree, a place along the paths, the lookout, or the campfire, and the survivor walks over and uses it once: gathering, chopping, exploring, repairing, or adding a log. On a phone held upright, the game fills the screen. Eat, Rest, Fire, and Sleep sit in a row at the bottom (with Cook and Stars at night, and Offer, when they are ready), and the Bag, Build, and Camp tabs slide up the rest of the panels. Tap the game or the tab again to close them. A dot on Build means something is ready to build or craft.

At night, the **After dark** panel offers two optional ways to spend a little time. Cook one berry at a lit campfire for a warmer, more filling meal; it takes eight seconds and restores 35 hunger and 10 warmth, in addition to the warmth you gain while near the fire. A drying rack raises the meal's hunger recovery to 50. Or watch the stars at camp for twelve seconds and regain 10 energy. The panel shows when each activity is ready. Neither activity is needed for survival, and you can still rest or sleep as before.

A day lasts four minutes, but how much of it is night changes with the seasons. In mid-autumn and mid-spring night falls after two minutes and forty seconds and lasts eighty seconds until dawn. Midwinter nights start after about two minutes ten and last nearly two minutes, and midsummer nights start after about three minutes ten and are under a minute long. The dial in the top bar shows where you are in the day, with that day's night shaded, and counts down to nightfall or dawn. Gathering takes six seconds and building takes twelve seconds, so daylight matters.

You tire slowly while awake, losing about one energy every six seconds you spend walking or idle; gathering and building cost their own energy instead. A rest at camp takes twenty seconds and restores 25 energy, or 50 with a bed. Once night falls and you have a shelter, you can sleep at camp until morning: the night still passes, so hunger falls and the fire burns down, but you wake with 60 more energy, or fully rested in a bed. Feed the fire before bed if you want to wake up warm, except in summer, when the nights stay warm without it. Cold is stronger outside at night. The fire provides warmth for 90 seconds per wood, and a shelter reduces cold exposure at camp. Hunger falls over time. Branches, berries, fiber plants, and rocks replenish at dawn.

When energy, hunger, or warmth falls to 20, its bar turns amber and you walk more slowly. The survivor shivers when cold, slumps and yawns when tired, and holds their stomach when hungry, and a message warns you once as each meter reaches its line. Being **tired** (energy 20 or less) makes gathering, chopping, digging, building, crafting, searching, and preparing rations take half as long again. Below 10 energy you are **exhausted**, and heavy work (chopping, digging, building, crafting, and repairing the lookout) has to wait until you rest; gathering by hand, eating, resting, and walking still work. Being **hungry** (hunger 20 or less) halves the energy you get back from resting, sleeping, the spring, and stargazing, and a hungry night's sleep won't lift you past 50 energy, even in a bed. At zero hunger you are **starving** and lose an extra energy every four seconds, even while resting or asleep. Berries grow back every dawn and a rest at camp is always there, so you can always recover.

Your bag holds eight spaces at first. To build, stand anywhere inside the marked circle around the campfire and click an upgrade in the “Little improvements” panel. Shelter costs six wood and two fiber; bed costs four wood and one fiber after shelter; storage crate costs four wood. Wood, food, fiber, and trail rations take one space each, but **stone is heavy and takes two**, so the bag's Carried count shows spaces used. Gather the pale seed heads for fiber and collect stone from the three rocks in camp, then choose what to carry home. Branches, berries, and fiber come back at dawn, but each rock gives **one stone, once**, and then stays as pebbles. Stone never runs out for good, though: the quarry beyond the west path always gives more (see **Beyond camp**). Every supply in the bag has a button that suits it: **Eat** a berry or a ration, **Burn** wood (the same as feeding the fire) or fiber (30 seconds of kindling) while at camp, or **Drop** a stone. A dropped stone stays on the ground where you stood, joining any loose pile within a tile, and you can pick it back up (E or a tap) when you have two free spaces. The bed improves resting; the crate raises carrying capacity to sixteen. A drying rack costs four wood, makes cooked berries more filling, and lets you prepare trail rations. A windbreak costs five wood and halves warmth loss at camp on unlit nights, including cold nights. A **stone pile** costs three wood and keeps up to twelve stone at camp outside your bag; use **Store 1** and **Take 1** beside it in the build list. A **toolshed** costs five wood and two fiber after the shelter; every tool is made there. The hearth, the stone axe, the pickaxe, and the lookout repair can all use stone from the pile as well as from your bag, spending bag stone first. All of these add visible structures to camp. The game has two fixed areas, camp and the quarry, and no combat.

### The seasons

The year has four seasons of ten days each, so a year is forty days. A new game starts in **autumn** on day 1, then comes **winter** (days 11–20), **spring** (21–30) and **summer** (31–40), and the year begins again with autumn on day 41. The day number keeps counting up. The top bar shows the season with the day (for example "Winter · Day 14 · Morning"), and a small wheel on the year journal's page shows where you are in the year and how many days are left in the season. A message greets the first morning of each season. The world changes colour with the seasons: broadleaf trees turn orange and gold in autumn and stand brown in winter, when snow lies on the ground, while the pines stay green all year. Leaves fall from the broadleaf trees on autumn days, and fireflies come out on summer nights.

### Winter

Winter is the hard season. **Every winter night is a bitter night**, like the cold night: the fire burns twice as fast, and you lose warmth quickly away from a lit fire, a little more slowly inside the shelter. A long winter night needs about three plain logs (two with the hearth). There is no penalty for a cold winter night, though; that stays with the autumn cold night. Once the cold night is behind you, the forecast card warns about winter nights and shows how much fire tonight needs.

Food and rest are harder to find. The **berry bushes stand bare** all winter (search one to see), so dry trail rations and keep berries before the snow comes; the bushes are full again on the first day of spring. The **quiet spring freezes over** and gives no rest, though you can still find it. Snow covers the ground and the paths, the camp circle stays a trodden patch, the birds leave until spring, and the crickets fall quiet. The fox still visits.

**Wolves** come close to a dark camp. On a winter night, when the fire burns low (under 20 seconds of fuel), one to three pairs of eyes watch from the edge of camp and you hear a howl now and then; they fade back when you feed the fire. The first time the fire goes out on a winter night, wherever you are, a wolf slips in and takes a trail ration from your bag, or a berry if you have no rations. If you are asleep, you hear about it when you wake. It happens at most once a night, and paw prints circle the fire pit until the next nightfall.

### Spring

Spring is wet and green. On about one spring day in three a **shower** passes through for part of the day ("Rain is coming in."), always clearing before nightfall. While it rains you lose warmth away from camp, or at camp without the shelter, as you would on an ordinary night (a lit fire still warms you), and the fire burns half as fast again; inside the shelter you stay comfortable. Puddles gather at camp after a shower and last until the day ends. The bushes are full again on spring's first day, more flowers come up across the meadow, the birds return, and two or three **rabbits** hop and nibble near the bushes, bolting if you come too close and creeping back once you leave. Trees chopped in spring grow back after two dawns instead of three.

### Summer

Summer is the season of plenty. **Nights are warm**: your warmth doesn't fall anywhere after dark, so the fire is optional, though it still warms you and you still need it to cook. (If the autumn cold night is somehow still waiting, its night stays cold.) In the **midday heat**, from a minute into the day until two minutes ten, you get hungry a quarter faster, and a message tells you when it starts. The bushes are heavy with fruit, so **each pick gives two berries**, or one if your bag has only one space left. Evenings glow gold for a little longer before night, fireflies come out after dark, and the birds and the fox are around as usual.

### The year journal

Below the field journal in the Camp tab sits **the year so far**, a keepsake of your time at camp. Each season has its own page, and each new year starts fresh pages ("Autumn, year two"). As small moments of the season happen, or as you try things the season invites, the survivor writes them down with the day, and a quiet line tells you: "Written in your journal: …". Blank lines with a "?" show how much of the season is still waiting to be found, without saying what. Missing one costs nothing; next year brings another chance. Leaf back through earlier seasons and years with the arrows. The journal is its own reward: nothing in it changes the game.

### A friend at camp

The birds, the fox and even the winter wolves can come to trust you, if you share what they like to eat. Watch what each of them nibbles at. When the moment is right, the hint line offers it (press **O**, or tap **Offer** among the buttons), and each animal takes one offering a day at most. Nothing is lost by waiting, and an animal shows it is warming to you before it stays. The first to be won over becomes your friend for good, and you only ever have one. The others stay wild and visit as before.

- **A bird** wakes you once on a winter night if the fire is about to go out, and sings at spring dawns. It stays all winter, flits between the trees and roofs near you, and lands on your shoulder when you stand still.
- **The fox** now and then leaves a berry by your bedroll at dawn, if your bag has room.
- **A young wolf** sees the wild wolves off when the fire goes out on a winter night, so nothing is taken. On winter nights it lifts its head and answers their howls.

Every few days your friend leaves a feather or a tuft of fur by the fire; walk over to pick it up. These keepsakes don't take bag space. Six of them make one thing at the toolshed: a **feather pillow** for the bed (resting there restores 10 more energy) or a **fur cloak** (you lose a quarter less warmth at night, at camp or in the quarry). Your friend stops shedding while you hold six, and has nothing more to give once the item is made.

### The cold night

The forecast card warns you about the cold night on **day 3**. It shows only while a cold night is on its way or in winter, and steps aside the rest of the year. Build a shelter and keep the fire burning through dawn while you stay at camp. The cold night burns fire fuel twice as fast. On day 3 two fresh logs at nightfall last the full night, but nights grow longer toward winter, so a later cold night can need three; the card says how many to bring. The card shows your shelter status and how much fuel is needed. Sleeping passes the night, but the fire still burns and the cold-night outcome still applies.

You'll know when it comes. On its day, from mid-afternoon, the light cools, the wind gets up and the fire's smoke streams sideways, and a message warns that tonight will be bitter. Once night falls, snow blows across the camp, frost creeps in round the edges of the view, and the day pill turns frosty and reads **Cold night** with a snowflake (just the snowflake on a phone). Winter's bitter nights bring the same snow and frost. If you sleep through the cold night, it plays out in a few quick seconds instead of a blink, and at dawn you're told plainly whether the fire held; if it did, the morning breaks warm and golden.

If you weather it with warmth above 20, you unlock the **stone hearth**. Build it for two wood and three stone to make each future log burn for 150 seconds instead of 90. If the camp is unprepared, you wake tired and lose 30 seconds of the morning; another cold night arrives three days later. You can always recover, gather more wood, and try again.

Weathering the cold night also teaches you to make a **stone axe**. Once the toolshed is built, craft it at camp from the **Forest tools** panel for one wood, one fiber, and one stone; until then the panel says "Build a toolshed first." Then stand near a mature tree and press **X** (or tap the tree) to chop it: it takes ten seconds and eight energy and gives two wood, leaving a stump that regrows after three dawns. Fallen branches stay easy to gather without the axe.

### Trail rations

Once the drying rack is built, you can dry one berry at camp into a **trail ration** (P, or **Prepare trail ration** in the sidebar); it takes twelve seconds. Eat a ration anywhere with T to restore 45 hunger, which makes longer trips along the paths easier. Rations count toward your bag like any other supply.

### Beyond camp

Four paths lead out of the clearing from the start, and a fifth, the west path, opens once the shelter is built. Three of them end at places to explore within two tiles of their marker: an **old basket** that holds two berries once, a **stone cairn** that gives two stone once, and a **quiet spring** where you can always stop for a twenty-second rest that restores 20 energy. The basket needs two free bag spaces and the cairn's two heavy stones need four; if your bag is too full, the find waits for you. Press V, tap the place, or use **Explore nearby place**.

The fourth path leads northeast to a damaged **lookout**. After you weather the cold night, bring four wood and two fiber and repair it while standing beside it (L, the sidebar button, or a tap). The two stone can come from your bag or the camp stone pile. It takes twelve seconds and six energy. A short closing scene celebrates the restored view, and then you can keep playing freely.

The pale frames in camp mark future building sites. Branch piles, berry bushes, fiber plants, and rocks show when they are ready to gather; they fade after collection (rocks leave pebbles) and replenish at dawn. The scene art is drawn in Phaser, so there are no external image assets to install.

The **field journal** in the sidebar shows the paths from camp and your position on a small map. Places keep their names hidden until you visit them, while the lookout stays marked from the start. Once the shelter is built, the west path joins the map, with the quarry marked at its end; while you are in the quarry area, your marker waits there. The journal also records shelter, cold night, quarry, and lookout milestones and suggests a next step, such as building the toolshed after the cold night. It reads your existing save progress, so returning camps show their discoveries immediately. Once the lookout is restored the milestones step aside, and the year journal takes over.

The wilderness has a little life of its own. Birds peck in the meadows and flutter off if you come too close or when night falls. On most evenings a fox visits the edge of camp and sits by the fire until well after dark, unless you walk up to it. Fireflies drift around camp on summer nights, and leaves drift down from the broadleaf trees on autumn days. None of this affects survival or the save.

### The west path and the quarry

Once the shelter is built, a fifth path opens toward the camp's west edge. Walk off the edge at the end of the path (or tap the path's end) and you arrive in a second area: rockier and more open, with few trees. Walk off its east edge to come home. The clock, hunger, warmth, energy, weather, and the cold-night schedule keep running there, but the fire stays at camp, and feeding it, sleeping, building, crafting, and the stone pile only work back in the camp area. Stone you drop stays in the area where you dropped it. If you save and come back while you are in the quarry area, you continue there.

Walk close to the **old quarry** to find it. Beside it lies a heap of loose **rubble**: pick a stone from it by hand (E or a tap) when you have two free bag spaces, and it loosens again three dawns later. Finding the quarry adds a **pickaxe** to the Forest tools panel. Craft it at camp with the toolshed built, for two wood, one fiber, and two stone; it does not need the axe. Then stand at the quarry face and dig (E, a tap, or the prompt). Digging takes ten seconds and eight energy and gives one stone, and the face shows as spent until the next dawn. On a day when both are ready, the rubble and the dig together give two stone. However you spend your stone, more always comes back.

At night, pairs of glowing eyes watch from the dark edges of the quarry area. They blink, back away, and vanish as you approach. They are only a look: nothing follows you, and they never harm you.

## Saving

Progress is saved in this browser's local storage under `hearthwild.save` after successful actions, periodically, and when the page is hidden or closed. Choose **Continue your camp** when you return. **Start a new game** asks before replacing an existing save. Only saves in the current format (version 15) load. A save from an earlier version shows a message that it could not be loaded, and you start a fresh camp. Loose stone piles (with the area they are in), the stone pile and its stored stone, spent rocks, the area you are in, the toolshed, the pickaxe, when the quarry and rubble are ready again, and the last wolf visit, the year journal, and your friend (with each animal's trust and the keepsakes) are all saved. Saves stay in this browser profile; private browsing, clearing site data, or switching devices will not carry them over. The game shows a message if storage fails or an existing save cannot be read. If saving keeps failing, the game says so once, then retries quietly after 10, 30 and 60 seconds while the status reads **Save failed · retrying**.

### Changing the save format

Only one open PR may change the save format (`SAVE_VERSION`, the saved shape, or a migration) at a time. Before merging, rebase it on `main` and take the next unused version number, so two branches never ship different shapes under the same version.

## Verify

```bash
npm run lint
npm test -- --run
npm run build
```

`npm test` runs the suites in `tests/`. Agent worktrees under `.superpowers/` are excluded. The tests cover game state, renewable fiber, mixed-material building, gathering, day/night survival, tiredness and sleep, being tired, exhausted, hungry, or starving, optional night activities, the clock, the seasons and the changing length of the night, winter nights, bare bushes, the frozen spring, wolves and their tracks, spring rain, puddles, flowers, rabbits and faster regrowth, warm summer nights, the midday heat and summer berries, golden evenings, camp upgrades, cold-night progression and the storm forecast, the stone axe and tree regrowth, the west crossing and the quarry area, rubble, the toolshed, the pickaxe and digging, the night eyes, trail rations, path discoveries, the lookout, the field journal, heavy and loose stone, the stone pile, the year journal and its pages, befriending, the companion's gifts, keepsakes, the pillow and the cloak, save validation, tap targets and walking, the phone dock, the sidebar tabs, pausing, and canvas scaling, and ambient wildlife timing. A browser playthrough should also check movement, tapping, building, fire, weather visuals, crossing to the quarry and back, and continuing after a reload (in either area), both at desktop size and on a phone held upright.

`npm test -- --run --coverage` also writes a coverage report to `coverage/`. CI runs it that way and then sends the code and the coverage report to [SonarCloud](https://sonarcloud.io/project/overview?id=hobsojam_survival), configured in `sonar-project.properties`. The scan needs a `SONAR_TOKEN` repository secret. Dependabot pull requests are never scanned, and pull requests from forks skip the scan because they don't receive the secret.

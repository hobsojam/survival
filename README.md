# Hearthwild

A small, single-player browser survival game about making a wilderness camp feel like home. You control one survivor, gather branches, berries, and fiber, keep a fire burning, and build a shelter, bed, drying rack, windbreak, stone pile, toolshed, and eventually a stone hearth, and weave a pack to carry more. In time the camp grows a house, vegetable beds, a well and a workshop. Beyond camp, a west path leads to a second area with an old quarry. Survival is gentle: cold and hunger slow you down, but they never end the game.

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
| E | Gather the nearest branches, berries, fiber plants, rocks, seasonal forage, loose stone, or quarry rubble within reach, or dig the quarry face with the pickaxe; at camp with nothing nearby, rest |
| F | Add one wood to the campfire while at camp |
| R | Rest at camp for a short break |
| Z | Sleep until morning (at night, at camp, once the shelter is built) |
| Q | Eat: the fresh food nearest to going soft (berries first if it's a tie), then a hazelnut, honey, roasted hazelnuts, or vegetables. Never pine needles or rations |
| C | Cook at a lit campfire after dark (once you live in the house, at home by the fireplace): one berry, or with the pot the first dish you have the food for |
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
| Bag buttons | Eat a berry, a ration, or one of your forage finds, burn wood or fiber at camp, or drop a stone where you stand |
| Store 1 / Take 1 | Move stone, wood, fiber or food between your bag and a built stone pile, woodpile, fibre stack or larder, in the clearing |

The buttons beside the game also let you eat, rest, feed the fire, and sleep. Your survivor's meters and those buttons stay at the top of the sidebar; below them, the **Bag**, **Build**, and **Camp** tabs each show one group of panels, and the sidebar remembers the tab you had open. A dot on Build means something there is ready. If the keyboard does not respond, click the game area once to focus it.

Press **Esc**, or the **Pause** button at the top, to pause. The clock, the fire, hunger, and the sounds all wait until you resume (Esc again, or **Resume** on the card over the game), and the game saves when you pause. The game also holds still while its browser tab is hidden.

You can also tap or click to play. Tap the ground to walk there. Tap a supply, a loose stone, a mature tree, a place along the paths, the lookout, or the campfire, and the survivor walks over and uses it once: gathering, chopping, exploring, repairing, or adding a log. On a phone held upright, the game fills the screen. Eat, Rest, Fire, and Sleep sit in a row at the bottom (with Cook and Stars at night, and Offer, when they are ready), and the Bag, Build, and Camp tabs slide up the rest of the panels. Tap the game or the tab again to close them. A dot on Build means something is ready to build or craft.

At night, the **After dark** panel offers two optional ways to spend a little time. Cook one berry at a lit campfire for a warmer, more filling meal; it takes eight seconds and restores 35 hunger and 10 warmth, in addition to the warmth you gain while near the fire. A drying rack raises the meal's hunger recovery to 50. Or watch the stars at camp for twelve seconds and regain 10 energy. The panel shows when each activity is ready. Neither activity is needed for survival, and you can still rest or sleep as before.

A day lasts about five and a half minutes of live play, but how much of it is night changes with the seasons. On the first day, night falls after about four minutes and lasts about eighty seconds. Midwinter nights start after about three minutes twenty-five seconds and last about two minutes, while midsummer nights start after about four minutes fifteen seconds and last about seventy-five seconds. The dial in the top bar shows where you are in the day, with that day's night shaded, and counts down in real time to nightfall or dawn. Gathering takes six game seconds and building takes twelve, so daylight matters.

You tire slowly while awake, losing about one energy every eight seconds of live play; gathering and building cost their own energy instead. A rest at camp takes twenty game seconds and restores 25 energy, or 50 with a bed. Once night falls and you have a shelter, you can sleep at camp until morning: the night still passes, so hunger falls and the fire burns down, but you wake with 60 more energy, or fully rested in a bed. Feed the fire before bed if you want to wake up warm, except in summer, when the nights stay warm without it. Cold is stronger outside at night. The fire provides warmth for 90 game seconds per wood, and a shelter reduces cold exposure at camp. Hunger falls over time. Branches, berries, fiber plants, and rocks replenish at dawn.

When energy, hunger, or warmth falls to 20, its bar turns amber and you walk more slowly. The survivor shivers when cold, slumps and yawns when tired, and holds their stomach when hungry, and a message warns you once as each meter reaches its line. Being **tired** (energy 20 or less) makes gathering, chopping, digging, building, crafting, searching, and preparing rations take half as long again. Below 10 energy you are **exhausted**, and heavy work (chopping, digging, building, crafting, and repairing the lookout) has to wait until you rest; gathering by hand, eating, resting, and walking still work. Being **hungry** (hunger 20 or less) halves the energy you get back from resting, sleeping, the spring, and stargazing, and a hungry night's sleep won't lift you past 50 energy, even in a bed. At zero hunger you are **starving** and lose an extra energy every four seconds, even while resting or asleep. Berries grow back every dawn and a rest at camp is always there, so you can always recover.

Your bag holds eight spaces at first. To build, stand anywhere in the clearing (it grows; see **Clearing more land**) and click an upgrade in the “Little improvements” panel. Shelter costs six wood and two fiber; bed costs four wood and one fiber after shelter. Wood, food, fiber, and trail rations take one space each, but **stone is heavy and takes two**, so the bag's Carried count shows spaces used. Gather the pale seed heads for fiber and collect stone from the three rocks in camp, then choose what to carry home. Branches, berries, and fiber come back at dawn, but each rock gives **one stone, once**, and then stays as pebbles. Stone never runs out for good, though: the quarry beyond the west path always gives more (see **Beyond camp**). Every supply in the bag has a button that suits it: **Eat** a berry or a ration, **Burn** wood (the same as feeding the fire) or fiber (30 seconds of kindling) while at camp, or **Drop** a stone. A dropped stone stays on the ground where you stood, joining any loose pile within a tile, and you can pick it back up (E or a tap) when you have two free spaces. The bed improves resting. A **woven pack**, made at the toolshed from the Forest tools panel, raises carrying capacity to sixteen; until then the Bag panel says "Weave a pack at the toolshed to carry 16.", and once you wear it the Carried count reads, say, "6/16" and its label becomes "Carried · woven pack".

The **Forest tools** panel also has a **woven pack**, for two wood and four fiber; it needs only the toolshed, not the axe or the cold night. Weave it standing in the clearing; wood from the woodpile and fiber from the fibre stack count, and the bag's are spent first. It doubles what you can carry, from eight spaces to sixteen, and you can see it on the survivor's back from then on. A drying rack costs four wood, makes cooked berries more filling, and lets you prepare trail rations. A windbreak costs five wood and halves warmth loss at camp (and at home in the house) on unlit nights, including cold nights. A **stone pile** costs three wood and keeps up to twelve stone at camp outside your bag; use **Store 1** and **Take 1** beside it in the build list. A **toolshed** costs five wood and two fiber after the shelter; every tool is made there. The hearth, the stone axe, the pickaxe, and the lookout repair can all use stone from the pile as well as from your bag, spending bag stone first. All of these add visible structures to camp. The game has two fixed areas, camp and the quarry, and no combat.

### The seasons

The year has four seasons of ten days each, so a year is forty days. A new game starts in **autumn** on day 1, then comes **winter** (days 11–20), **spring** (21–30) and **summer** (31–40), and the year begins again with autumn on day 41. The day number keeps counting up. The top bar shows the season with the day (for example "Winter · Day 14 · Morning"), and a small wheel on the year journal's page shows where you are in the year and how many days are left in the season. A message greets the first morning of each season. The world changes colour with the seasons: broadleaf trees turn orange and gold in autumn and stand brown in winter, when snow lies on the ground, while the pines stay green all year. Leaves fall from the broadleaf trees on autumn days, and fireflies come out on summer nights.

#### Forage

Each season has its own wild food, found a little way out from the clearing, and you only see a spot in its season. Gather with E or a tap, and eat from the Bag panel or with Q.

- **Autumn: hazelnuts.** Three hazels grow at the feet of the broadleaf trees. Each gives a hazelnut a day (15 hunger), and hazelnuts keep.
- **Winter: pine needles.** Three young pines give a bunch of needles a day. They are for tea, not for eating raw.
- **Spring: wild greens.** Two patches grow near the quiet spring and one out in the meadow, and two more come up for the rest of the day once a shower starts. A handful a day from each (15 hunger), but greens go soft like berries.
- **Summer: honey.** Bees keep a hollow tree north of camp. Take a little honey (20 hunger and 5 energy); the bees need three dawns to make more.

Each of these shows in the Bag panel only while you carry some.

### Winter

Winter is the hard season. **Every winter night is a bitter night**, like the cold night: the fire burns twice as fast, and you lose warmth quickly away from a lit fire, a little more slowly inside the shelter. A long winter night needs about three plain logs (two with the hearth). There is no penalty for a cold winter night, though; that stays with the autumn cold night. Once the cold night is behind you, the forecast card warns about winter nights and shows how much fire tonight needs.

Food and rest are harder to find. The **berry bushes stand bare** all winter (search one to see), so dry rations and gather nuts before the snow comes; the bushes are full again on the first day of spring. The **quiet spring freezes over** and gives no rest, though you can still find it. Snow covers the ground and the paths, the camp circle stays a trodden patch, the birds leave until spring, and the crickets fall quiet. The fox still visits.

**Wolves** come close to a dark camp. On a winter night, when the fire burns low (under 20 seconds of fuel), one to three pairs of eyes watch from the edge of camp and you hear a howl now and then; they fade back when you feed the fire. The first time the fire goes out on a winter night, wherever you are, a wolf slips in and takes a trail ration from your bag, or a berry if you have no rations. If you are asleep, you hear about it when you wake. It happens at most once a night, and paw prints circle the fire pit until the next nightfall.

### Spring

Spring is wet and green. On about one spring day in three a **shower** passes through for part of the day ("Rain is coming in."), always clearing before nightfall. While it rains you lose warmth away from camp, or at camp without the shelter, as you would on an ordinary night (a lit fire still warms you), and the fire burns half as fast again; inside the shelter you stay comfortable. Puddles gather at camp after a shower and last until the day ends. The bushes are full again on spring's first day, more flowers come up across the meadow, the birds return, and two or three **rabbits** hop and nibble near the bushes, bolting if you come too close and creeping back once you leave. Trees chopped in spring grow back after two dawns instead of three.

### Summer

Summer is the season of plenty. **Nights are warm**: your warmth doesn't fall anywhere after dark, so the fire is optional, though it still warms you and you still need it to cook. (If the autumn cold night is somehow still waiting, its night stays cold.) In the **midday heat**, from a minute into the day until two minutes ten, you get hungry a quarter faster, and a message tells you when it starts. The bushes are heavy with fruit, so **each pick gives two berries**, or one if your bag has only one space left. Evenings glow gold for a little longer before night, fireflies come out after dark, and the birds and the fox are around as usual.

### The year journal

Below the field journal in the Camp tab sits **the year so far**, a keepsake of your time at camp. Each season has its own page, and each new year starts fresh pages ("Autumn, year two"). As small moments of the season happen, or as you try things the season invites, the survivor writes them down with the day, and a quiet line tells you: "Written in your journal: …". Blank lines with a "?" show how much of the season is still waiting to be found, without saying what. Missing one costs nothing; next year brings another chance. Each page has six lines, including a few from the foraging year: the first hazelnuts of autumn, pine needle tea in winter, a spring salad, and wild honey in summer. Leaf back through earlier seasons and years with the arrows. The journal is its own reward: nothing in it changes the game.

### A friend at camp

The birds, the fox and even the winter wolves can come to trust you, if you share what they like to eat. Watch what each of them nibbles at. When the moment is right, the hint line offers it (press **O**, or tap **Offer** among the buttons), and each animal takes one offering a day at most. Nothing is lost by waiting, and an animal shows it is warming to you before it stays. The first to be won over becomes your friend for good, and you only ever have one. The others stay wild and visit as before. The fox takes a berry, but in winter, when the bushes are bare, it will take a hazelnut instead if you have one (in the bag, or in the larder while you are in the clearing).

- **A bird** wakes you once on a winter night if the fire is about to go out, and sings at spring dawns. It stays all winter, flits between the trees and roofs near you, and lands on your shoulder when you stand still.
- **The fox** now and then leaves a berry by your bedroll at dawn, if your bag has room.
- **A young wolf** sees the wild wolves off when the fire goes out on a winter night, so nothing is taken. On winter nights it lifts its head and answers their howls.

Every few days your friend leaves a feather or a tuft of fur by the fire; walk over to pick it up. These keepsakes don't take bag space. Six of them make one thing at the toolshed: a **feather pillow** for the bed (resting there restores 10 more energy) or a **fur cloak** (you lose a quarter less warmth at night, at camp or in the quarry). Your friend stops shedding while you hold six, and has nothing more to give once the item is made.

### The cold night

The forecast card warns you about the cold night on **day 3**. It shows only while a cold night is on its way, in winter, and in late autumn (days 8–10) when it warns the bushes are about to go bare, and steps aside the rest of the year. Build a shelter and keep the fire burning through dawn while you stay at camp. The cold night burns fire fuel twice as fast. On day 3 two fresh logs at nightfall last the full night, but nights grow longer toward winter, so a later cold night can need three; the card says how many to bring. The card shows your shelter status and how much fuel is needed. Sleeping passes the night, but the fire still burns and the cold-night outcome still applies.

You'll know when it comes. On its day, from mid-afternoon, the light cools, the wind gets up and the fire's smoke streams sideways, and a message warns that tonight will be bitter. Once night falls, snow blows across the camp, frost creeps in round the edges of the view, and the day pill turns frosty and reads **Cold night** with a snowflake (just the snowflake on a phone). Winter's bitter nights bring the same snow and frost. If you sleep through the cold night, it plays out in a few quick seconds instead of a blink, and at dawn you're told plainly whether the fire held; if it did, the morning breaks warm and golden.

If you weather it with warmth above 20, you unlock the **stone hearth**. Build it for two wood and three stone to make each future log burn for 150 seconds instead of 90. If the camp is unprepared, you wake tired and lose 30 seconds of the morning; another cold night arrives three days later. You can always recover, gather more wood, and try again.

Weathering the cold night also teaches you to make a **stone axe**. Once the toolshed is built, craft it at camp from the **Forest tools** panel for one wood, one fiber, and one stone; until then the panel says "Build a toolshed first." Then stand near a mature tree and press **X** (or tap the tree) to chop it: it takes ten seconds and eight energy and gives two wood, leaving a stump that regrows after three dawns. Fallen branches stay easy to gather without the axe.

### Camp stores

Fresh berries and greens go soft after three dawns in your bag. Once the north side's near ground is cleared (see **Clearing more land**), you can build a **larder** there for five wood, two fiber and two stone: a little cache raised on four legs, with a ladder. It keeps up to ten food outside your bag, and fresh food keeps **five dawns** in it instead of three. Under the Larder in the build list, **Store 1** puts the oldest piece of that food from your bag into the larder, and **Take 1** brings the freshest back out; kept food such as hazelnuts and rations moves one at a time too. A row shows for each food while you have some in your bag or the larder.

While you stand anywhere in the clearing, the larder is as good as your bag: eating, Q, cooking, drying rations, planting and offerings all reach into it, spending the oldest fresh food across both (your bag's first on a tie) and kept food from your bag first. Away from camp, or in the quarry, only your bag counts. Food in the larder still goes soft at dawn wherever you are, and one morning note covers what was thrown out of both. The larder doesn't count toward your bag, and a wolf in the dark camp never raids it, though you can choose to leave a larder ration out for one.

Once the east side's near ground is cleared, you can build a **woodpile** there for three wood and one fiber: split logs stacked under a little roof, holding up to twelve. In the build list, **Store 1** stacks a log from your bag and **Take 1** brings one back out (in the clearing). Wood on the pile counts as wood you carry, from anywhere: building, repairing, crafting, clearing land and the cold-night forecast all spend your bag's wood first and then the pile's, and **Burn** at the fire uses the pile's wood when your bag is empty. The Bag panel's wood shows `+n at camp`.

The same ground has room for a **fibre stack** too, for two wood and three fiber: a small rick of pale bundles under a thatched cap, keeping up to twelve fiber dry. **Store 1** tucks a bundle from your bag under the thatch and **Take 1** brings one back out (in the clearing). Fiber in the stack counts as fiber you carry, from anywhere: building, repairing the lookout, crafting tools and clearing land all spend your bag's fiber first and then the stack's, and **Burn** at the fire uses the stack's fiber when your bag is empty. The Bag panel's fiber shows `+n at camp`.

Once the north side's far ground is cleared, you can build a **house** there for twelve wood, six fiber and eight stone, after the shelter is finished with its door and shutters and the bed is built. It takes twice as long as other buildings. It's a small log house with a stone chimney, a door and one window. You move in the moment it's built: you carry your bed inside, and the house has a fireplace of its own. The shelter then becomes a **woodshed**, its front left open with logs stacked inside. The woodpile and the woodshed share one wood store: it holds twelve with the woodpile, twenty-four with the woodshed, and thirty-six with both. With the house built, Store 1 and Take 1 work even without a woodpile, and the Bag panel reads, say, `Stored wood 20/36`.

Once you live in the house, its **fireplace** keeps you warm in place of the campfire. It feeds itself from the wood store: whenever it is night and the fireplace has burned down, it takes one log from the store (never from your bag) for 200 seconds of fire, against the stone hearth's 150. It burns only at night, at one second a second, or twice as fast on a freezing night, and whatever is left at dawn is banked until the next night. It burns wherever you are, but it only warms you at home, within a couple of steps of the house. To feed it by hand, store wood from your bag. Home is now where you sleep, rest and cook: away from the house the game says `Go home to sleep.`, `Go home to rest.` or `Go home to cook.`, and cooking needs the fireplace lit. The fireplace is the fire that counts for the wolves, the cold night, your bird's alarm and the storm forecast, which counts the logs in the store. The Bag panel's fire line follows it, for example `The fireplace is burning · 9 logs in store` at night, `The fireplace is banked · 9 logs in store` by day, `Wood is running low · 2 logs in store`, or `The fireplace is out. Stock the wood store.` The window glows and the chimney smokes while it burns. The campfire is optional from then on: you can still feed it, its hearth and light still work, and it still warms you while you stand at it. The autumn journal page gains a line for a night by the fireplace.

### Vegetable beds

Once the west side's near ground is cleared, you can build the **vegetable beds** there for six wood and two fiber: three small raised beds edged in dark wood, one each for **potatoes**, **beans** and **carrots**. The **Vegetable beds** panel in the Camp tab, under the berry garden, has a line for each bed, such as `Carrots · Growing · Dry, water soon`, with a **Sow** or **Harvest** button. Tend them anywhere in the clearing.

Sowing is free: each bed keeps its own seed, through every harvest and even if the crop withers, so an empty bed can always be sown again. Sowing takes the same time and energy as planting a berry bush, and works in spring, summer and autumn. A sown bed sprouts, then grows a day at each dawn, and is **ready to harvest** after three days of growth. Harvesting gives two **vegetables** and empties the bed for sowing again; you need two free spaces in your bag. Vegetables are kept food: they never go soft, take one bag space each, keep in the larder, and can be eaten raw from the Bag panel (or with Q) for 20 hunger.

The beds need water. A day of spring rain waters them, and so does a bucket from the well. On a dry day a bed dries a little: after two dry days in a row its soil looks pale and cracked (`Dry, water soon`), it still grows on the first two, stops growing on the third (`Wilting, water today`), and on the fourth dry dawn the crop **withers**. A morning note says so ("The carrots withered in the dry. You saved the seed.") and the bed is empty again, seed kept. A rain day resets the dryness. A **ripe** crop never dries out or withers; it waits for you, all winter if need be. In **winter** the beds rest under the frost: nothing is sown (an empty bed reads `Empty, resting for winter`), and a growing crop keeps its growth and its dryness until spring, then carries on.

### The well

Once the vegetable beds are built and the west side's far ground is cleared, you can build a **well** there for two wood and six stone: a round stone well under a small wooden roof, with a crank and a bucket, edged in dark wood. With the well built, the Vegetable beds panel gains a **Draw water** button. One bucket waters every sown bed that isn't ripe yet, for that day, and takes the same time and energy as gathering. Draw water from anywhere in the clearing, in spring, summer and autumn. Once is enough for a day: when every growing bed has been watered today, the button says so (`The beds are already watered today.`), and once the day's rain has begun it says `The rain has watered the beds today.` A bed sown after you drew water hasn't had any yet, so you can draw again for it. When the button can't be used, the reason shows beneath it. The well also lets you cook **vegetable stew** in the pot.

### The workshop

Once the toolshed is built and the east side's far ground is cleared, you can build a **workshop** there for ten wood, four fiber and six stone: an open-fronted timber workshop with a workbench and a saw on the wall. The journal points you to it once the ground is clear. The **workshop** panel in the Build tab offers three upgrades, each made once, standing anywhere in the clearing, with the same time and energy as a build; stored wood, fiber and stone count, bag first.

- **Saw** (three wood, three stone): felling a tree gives **four wood** instead of two, including trees marked for clearing. Stumps regrow as before.
- **Handcart** (eight wood, two fiber, one stone): a two-wheeled cart parks below the workshop and holds twelve wood. Felled wood goes into the cart first ("Chopped the tree. Four wood went into the cart. A stump remains."), then the bag. Wood in the cart counts as stored wood: builds, the campfire and the house fireplace all use it, spending from the bag, then the cart, then the woodpile and woodshed (the fireplace takes from the woodpile and woodshed before the cart). **Unload the cart** moves as much as fits onto the wood store at once, and anything left stays in the cart. The panel reads, say, `Cart 5/12 wood`, and the cart looks empty, part-full or full.
- **Hoe and watering can** (three wood, one fiber, one stone; needs the vegetable beds): a dry bed holds on a day longer before it withers. A crop still stops growing on its third dry day, so it still needs water to ripen, but it withers on the fifth dry dawn instead of the fourth.

If the bag (and cart) can't take all of a felled tree's wood, felling is refused and nothing is lost.

### Trail rations

Once the drying rack is built, you can dry one berry at camp into a **trail ration** (P, or **Prepare trail ration** in the sidebar); it takes twelve seconds. Eat a ration anywhere with T to restore 45 hunger, which makes longer trips along the paths easier. Rations count toward your bag like any other supply.

### Cooking

After nightfall, at a lit campfire (or, once you live in the house, at home by the lit fireplace), C (or **Cook a berry** in the After dark panel) toasts one berry for 35 hunger (50 with the drying rack) and 10 warmth. It takes eight seconds.

Once the toolshed is built, you can make a **cooking pot** in the Forest tools panel for one wood and two stone (the stone can come from the camp stone pile). It hangs over the fire on a little tripod, steaming while the fire burns. With the pot, the After dark panel offers a button for each dish, and C cooks the first one you have the food for, in this order:

| Dish | Ingredients | What it does |
|---|---|---|
| Cooked berry | 1 berry | 35 hunger (50 with the drying rack), 10 warmth |
| Pine needle tea | 1 pine needles | 20 warmth, 5 energy |
| Greens and berry salad | 1 greens, 1 berry | 40 hunger, 10 energy |
| Roasted hazelnuts | 2 hazelnuts | a portion of roasted hazelnuts for your bag, eaten later for 50 hunger |
| Honey cake | 1 honey, 1 hazelnut, 1 berry | 60 hunger, and your next rest or sleep at camp restores 10 more energy |
| Vegetable stew | 2 vegetables | 55 hunger, 15 warmth; needs the well |

Pot dishes keep the same evening ritual: after dark, at camp, at a lit fire, eight seconds each.

### Beyond camp

Four paths lead out of the clearing from the start, and a fifth, the west path, opens once the shelter is built. Three of them end at places to explore within two tiles of their marker: an **old basket** that holds two berries once, a **stone cairn** that gives two stone once, and a **quiet spring** where you can always stop for a twenty-second rest that restores 20 energy. The basket needs two free bag spaces and the cairn's two heavy stones need four; if your bag is too full, the find waits for you. Press V, tap the place, or use **Explore nearby place**.

The fourth path leads northeast to a damaged **lookout**. After you weather the cold night, bring four wood and two fiber and repair it while standing beside it (L, the sidebar button, or a tap). The two stone can come from your bag or the camp stone pile. It takes twelve seconds and six energy. A short closing scene celebrates the restored view, and then you can keep playing freely. Repairing it reveals the old quarry and its stone in the field journal's area overview, even if you have not visited yet.

The pale frames in camp mark future building sites. Fallen branches lie under the trees they dropped from, the nearest few round the edge of the camp clearing, a short walk from the fire. Branch piles, berry bushes, fiber plants, and rocks show when they are ready to gather; they fade after collection (rocks leave pebbles) and replenish at dawn. The scene art is drawn in Phaser, so there are no external image assets to install.

The **field journal** in the sidebar shows an area overview: camp and the routes to other areas. Once the shelter is built, the west path appears as an unknown destination. Finding the quarry or repairing the lookout reveals the old quarry, its stone, loose rubble, and quarry face. The overview names the area you are in, and future areas can join the same route list. Places along the camp paths remain listed below it, along with shelter, cold night, quarry, and lookout milestones. The journal suggests a next step, such as building the toolshed after the cold night. It reads your existing save progress, so returning camps show their discoveries immediately. Once the lookout is restored the milestones step aside, and the year journal takes over.

The wilderness has a little life of its own. Birds peck in the meadows and flutter off if you come too close or when night falls. On most evenings a fox visits the edge of camp and sits by the fire until well after dark, unless you walk up to it. Fireflies drift around camp on summer nights, and leaves drift down from the broadleaf trees on autumn days. None of this affects survival or the save.

### The west path and the quarry

Once the shelter is built, a fifth path opens toward the camp's west edge. Walk off the edge at the end of the path (or tap the path's end) and you arrive in a second area: rockier and more open, with boulders, scrub and a ring of woods. A worn path runs from the quarry face to its east edge, where a signpost points home, and walking off that edge brings you back to camp. A matching signpost at camp marks the west path. The clock, hunger, warmth, energy, weather, and the cold-night schedule keep running there, but the fire stays at camp, and feeding it, sleeping, building, crafting, and the stone pile only work back in the camp area. Stone you drop stays in the area where you dropped it. If you save and come back while you are in the quarry area, you continue there.

Walk close to the **old quarry** to find it. Beside it lies a heap of loose **rubble**: pick a stone from it by hand (E or a tap) when you have two free bag spaces, and it loosens again three dawns later. Finding the quarry adds a **pickaxe** to the Forest tools panel. Craft it at camp with the toolshed built, for two wood, one fiber, and two stone; it does not need the axe. Then stand at the quarry face and dig (E, a tap, or the prompt). Digging takes ten seconds and eight energy and gives one stone, and the face shows as spent until the next dawn. On a day when both are ready, the rubble and the dig together give two stone. However you spend your stone, more always comes back.

At night, pairs of glowing eyes watch from the dark edges of the quarry area. They blink, back away, and vanish as you approach. They are only a look: nothing follows you, and they never harm you.

## Saving

Progress is saved in this browser's local storage under `hearthwild.save` after successful actions, periodically, and when the page is hidden or closed. Choose **Continue your camp** when you return. **Start a new game** asks before replacing an existing save. Only saves in the current format (version 23) load. A save from an earlier version shows a message that it could not be loaded, and you start a fresh camp. The clearing (which steps are cleared, the marked trees and which are felled) and loose stone piles (with the area they are in), the stone pile and its stored stone, spent rocks, the area you are in, the toolshed, the pickaxe, the woven pack, the fibre stack and its stored fiber, the house, the wood store and the fireplace's fuel, the vegetable beds (each bed's growth, dryness and the last day it was watered), the workshop's upgrades and the wood in the handcart, when the quarry and rubble are ready again, and the last wolf visit, the year journal, and your friend (with each animal's trust and the keepsakes) are all saved. Saves stay in this browser profile; private browsing, clearing site data, or switching devices will not carry them over. The game shows a message if storage fails or an existing save cannot be read. If saving keeps failing, the game says so once, then retries quietly after 10, 30 and 60 seconds while the status reads **Save failed · retrying**.

### Clearing more land

Once the stone axe is crafted, the **Clear the land** group appears under the build list. The clearing has four sides, north, east, south and west, and each side has a **near** step and then a **far** step. Choose a side to mark its trees, fell every marked tree with the axe, then press **Clear the ground** to widen the clearing there. A near step costs four wood and two fiber; a far step costs six wood and three fiber and needs the near step cleared first. Near steps mark four trees and far steps six, except the west side's near step, which marks only **two**. Stumps of felled marked trees stay until their ground is cleared, and they never regrow. Once you have felled a tree on one side you must finish that side before choosing another. Each cleared step shows the buildings it makes room for: the north side's near ground has room for a larder, the north side's far ground for a house, the east side's near ground for a woodpile and a fibre stack, the west side's near ground for the vegetable beds, the east side's far ground for a workshop, and the west side's far ground for a well.

You can build anywhere in the clearing, however far it has grown, but the fire's warmth, resting and sleeping still work only within the old circle around the fire (or, once you live in the house, at home by the house), so the warmth falls away on the new ground at night. Branch piles that the wider clearing swallows move out to the new edge.

### Changing the save format

Only one open PR may change the save format (`SAVE_VERSION`, the saved shape, or a migration) at a time. Before merging, rebase it on `main` and take the next unused version number, so two branches never ship different shapes under the same version.

## Verify

```bash
npm run lint
npm test -- --run
npm run build
```

`npm test` runs the suites in `tests/`. Agent worktrees under `.superpowers/` are excluded. The tests cover game state, renewable fiber, mixed-material building, gathering, day/night survival, tiredness and sleep, being tired, exhausted, hungry, or starving, optional night activities, the clock, the seasons and the changing length of the night, winter nights, bare bushes, the frozen spring, wolves and their tracks, spring rain, puddles, flowers, rabbits and faster regrowth, warm summer nights, the midday heat and summer berries, seasonal forage and what Q eats, golden evenings, camp upgrades, the growing clearing and its marked trees, cold-night progression and the storm forecast, the stone axe and tree regrowth, the west crossing and the quarry area, rubble, the toolshed, the pickaxe and digging, the night eyes, trail rations, path discoveries, the lookout, the field journal, heavy and loose stone, the stone pile, the year journal and its pages, food and spoilage, seasonal foraging, cooking, the larder, the woodpile, the fibre stack, the house and the woodshed, the house fireplace, the vegetable beds, their crops, watering by rain, drying and withering, the well, drawing water and vegetable stew, the workshop, the saw, the handcart and the bed tools, the woven pack, befriending, the companion's gifts, keepsakes, the pillow and the cloak, save validation, tap targets and walking, the phone dock, the sidebar tabs, pausing, and canvas scaling, and ambient wildlife timing. A browser playthrough should also check movement, tapping, building, fire, weather visuals, crossing to the quarry and back, and continuing after a reload (in either area), both at desktop size and on a phone held upright.

`npm test -- --run --coverage` also writes a coverage report to `coverage/`. CI runs it that way and then sends the code and the coverage report to [SonarCloud](https://sonarcloud.io/project/overview?id=hobsojam_survival), configured in `sonar-project.properties`. The scan needs a `SONAR_TOKEN` repository secret. Dependabot pull requests are never scanned, and pull requests from forks skip the scan because they don't receive the secret.

`npm run mutate` runs Stryker against the food rules. It writes HTML and JSON reports under `reports/`. The separate **Mutation testing** workflow runs each Tuesday at 06:17 UTC, can also be started manually, and keeps its report as a 14-day artifact. This first pass is informational: a low mutation score does not fail the workflow. Review surviving mutants and the run time before expanding the file list or setting a score threshold. The `minimatch` and `qs` overrides keep Stryker's transitive dependencies clear of the advisories checked by `npm audit`.

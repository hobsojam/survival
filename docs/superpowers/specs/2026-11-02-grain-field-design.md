# Grain Field and Granary Design

## Intent

The homestead plan (`2026-10-31-homestead-buildings-design.md`) kept the south ground free for a field. This design fills it with a **grain field** and a **granary**.

The player already has two small growing spots. The berry garden gives three bushes and one small harvest each autumn. The vegetable beds give a crop every few days, watered from the well. The field should feel different from both. It works at a bigger scale and over a longer time: **one big sowing in spring, one harvest you work for at the end of summer, and enough food stored to carry you through winter.** The user chose grain over a root crop because it is the most distinct from what the game already has.

The user's homestead rule still applies: **a building existing must not magically remove a need.** The field makes winter easier because the player sowed, cut, threshed and stored it. It is not a free larder.

The game is a cosy camp builder (see the README and the year journal). Every feature is judged by its charm, and nothing the player has planted is ever taken away.

## The three projects

Bread comes in three steps, each its own project. **This design covers the first one.**

1. **The field, the granary and the hand tools** (this design). From the first harvest, the player can make bread by hand: cut with a sickle, thresh with a flail, grind in a hand quern, and bake a loaf at the fire. It's slow, but it works.
2. **The mill** (later, not designed here). It grinds a whole sack at once instead of a handful at a time.
3. **The bakery** (later, not designed here). Its oven bakes a batch of loaves together instead of one at the fire.

This was the user's choice: bread from the first harvest, with the mill and bakery as later upgrades that make the work lighter.

## Goals

- A grain field on the south ground, sown in spring and harvested from late summer.
- A granary that holds the threshed grain.
- Hand tools: a sickle and flail for the harvest, and a hand quern for grinding.
- Bread, baked at the fire, as a filling winter food.
- One good harvest feeds the survivor through a whole winter without foraging.

## Non-goals

- The mill and the bakery (see above).
- A paddock, livestock or a draft animal. The south ground goes to the field, and a paddock later needs its own space, probably in a new area.
- Crop rotation, fertilising, weeds, pests, crop disease or more than one kind of grain.
- Watering the field. It grows on its own.
- Changing the berry garden, the vegetable beds, the well or existing foraging.

## Anti-goals (a failure even if it technically works)

- **A food mountain.** This was the user's strongest concern: the field should make life easier, not bury the player in food. Three rules guard against it:
  1. **One harvest is sized to one winter.** It gives about 15–20 loaves' worth of grain and no more.
  2. **The granary holds exactly one harvest.** Grain left over from last year partly fills it, and a new harvest only tops it back up to full. Threshed grain that won't fit is simply not gathered. Grain can never pile up over the years.
  3. **Grain stays as grain until it is used.** The player grinds and bakes a little at a time. Bread is fresh food and goes soft like berries *(my call)*, so baking a stockpile of loaves doesn't pay.
- **A daily chore.** The field needs no visit between sowing and harvest.
- **Punishing timing.** Ripe grain waits in the field until it is cut, through autumn and winter if need be. It is never lost. *(My call, from the game's rule that nothing planted is taken away.)*

## Where it goes

- **The field** stands on the **south far** step (`ground: 'south-far'`), the bigger of the two south steps. *(My call.)*
- **The granary** stands on the **south near** step (`ground: 'south-near'`), between the field and the fire. *(My call.)*
- Clearing works as it does for other buildings. The near ground must be cleared before the far ground, so the granary's ground is always ready before the field's. Both steps get `room` entries.

## The field's year

The year runs autumn, winter, spring, summer, with 10 days to a season (`src/game/calendar.ts`). A new game starts in autumn. The first sowing is therefore in spring of year one, and the first bread comes in the second winter. The first winter is still fed by foraging, as it is today.

### First seed

- **Wild grain** grows in a small patch near the clearing's edge. Gathering it gives the first seed. *(The user agreed to this. Where the patch is, and when it can be gathered, are the builder's call. It must be gatherable before the player's first spring.)*
- **Seed is counted in strips.** One seed sows one strip. *(My call.)*
- Each gather at the wild patch gives **one strip's seed**. The patch comes back at dawn like other resource nodes, so a player can gather enough for the whole field over a few days, and the first harvest can be a full one. The patch stays gatherable in later years as a fallback. *(My call.)*
- **Each threshed strip keeps back one strip's seed** for next year. A full harvest therefore sows the whole field again, and a partial one sows as many strips as were threshed. *(My call.)*
- Seed is held separately from the granary's grain and isn't part of its capacity. It is never eaten and never spoils, so a full granary or a hungry winter can never cost the player next year's sowing. *(My call.)*

### Sowing (spring)

- The field is split into **strips** *(my call: four strips)*. Each strip is sown separately with one gather action (E, a tap, the standard gather time and energy).
- Sowing works only in spring.
- A strip can be sown only if there is seed. One harvest's kept seed sows the whole field.

### Growing (summer)

- Sown strips grow by themselves through summer. They need no watering or tending.
- The art shows the growth: bare earth, green shoots, tall green stalks, then gold.
- The grain is **ripe** partway through summer *(builder's call, for example from summer day 5)*. It stays ripe until it is cut.

### Harvest (late summer onwards)

- **Cutting** a ripe strip uses the **sickle**: one action per strip, which leaves sheaves standing in stooks on the strip.
- **Threshing** uses the **flail** and happens **at the field, where the stooks stand**: one action per cut strip. That strip's grain goes straight into the granary, and its seed is kept back. Sheaves are never carried and are never a bag item. *(The user's choice. The work is the time and energy of cutting and threshing, not hauling.)*
- Cutting and threshing take more time and energy than an ordinary gather. With the energy that costs, bringing in the whole field takes **a few sessions over a day or two**, not one visit. *(Exact times and energy are the builder's call. It should feel like real work without becoming a grind.)*
- A strip goes **empty → sown → ripe → cut (stooks) → threshed (empty again)**. It is only ever in one state.
- Ripe grain and stooks wait through autumn and winter. They are never lost to time.
- **A strip has to be threshed before it can be sown again.** A strip still ripe in spring is cut and threshed, then sown.
- **If the granary is full**, threshing still keeps that strip's seed, but grain that doesn't fit isn't kept, and a plain line says the granary is full. This follows the user's rule that a new harvest only tops the granary up, and it wins over "never lost". *(My call on how to reconcile the two.)*

### Winter

- The field lies bare or under snow. The player grinds and bakes from the granary.

## The granary

- A new building, `granary`, on the south near step. It requires the field *(my call)*, so it is built once there's something to store. Its cost is mostly wood, with some stone for the footing *(exact cost is the builder's call)*.
- It holds **one harvest's grain** (`BALANCE.granaryCapacity`, sized to match a full field's yield).
- Grain lives only in the granary. It is **not** a bag item and doesn't take bag space.
- The granary is drawn as a small raised timber store on stone legs, in the game's palette.
- It has a **Granary panel** on the Camp tab showing the grain stored and the seed kept for next year.

## Tools

- The **sickle and flail** are made at the **workshop** as one upgrade, "harvest tools". The **hand quern** is a second upgrade. *(The user agreed the tools come from the workshop. Splitting them into two upgrades is my call: the quern isn't needed until after the first harvest.)*
- The harvest tools require the field. The quern requires the granary.
- They follow the existing `WORKSHOP_UPGRADES` pattern: made once, with costs from wood, fiber and stone. Unlike the saw and the handcart, these upgrades are needed before the harvest can happen. The Build list and panels should make that clear when a ripe field is waiting and no sickle has been made yet.

## From grain to bread

- **Grinding:** at the granary, with the quern, one action turns a little grain into **flour** in the bag. *(Amounts are the builder's call, for example 2 grain to 1 flour.)* Flour takes one bag space, can go in the larder, and never spoils.
- **Baking:** a **loaf** is a new dish baked from flour at the cooking fire (the campfire, or the house's fireplace once the survivor lives there). Baking doesn't need the pot, and it needs no water, so the well isn't required. *(My call.)*
- **Eating:** a loaf is one of the most filling foods, on a par with stew and honey cake *(the exact hunger value is the builder's call)*. It is fresh food: it goes soft after a few dawns in the bag, or a few more in the larder, like berries.
- **Sizing:** a full field's grain bakes about 15–20 loaves. With winter at 10 days, that's enough to eat bread through the whole season without foraging, and not much more. *(These numbers are a starting point. The builder tunes the yield, the grind ratio and the hunger value together so that one harvest is about one winter.)*

## How the player learns this

- A short message when the wild grain is first found, pointing to the south ground.
- At the first spring dawn when the field is built and there's seed, a line saying it's time to sow.
- A line when the grain turns gold. If no harvest tools have been made, it mentions the workshop.
- A year-journal entry for the first harvest brought in and one for the first loaf. *(Wording, and which season each entry belongs to, are the builder's call, following the year journal's existing style.)*

## Constraints

- **Stack:** TypeScript, Phaser 3, Vite, Vitest (node environment), oxlint. Art is drawn in code in `src/art/` from the existing palette, with no image files.
- **Patterns to follow:**
  - Buildings are `BUILDINGS` entries with `ground`, `prerequisite` and `cost`, sited through the clearing's `room` lists and `CAMP_STRUCTURES`.
  - Workshop upgrades are `WORKSHOP_UPGRADES` entries.
  - Dishes are `DISHES` entries in `src/game/cooking.ts`. Food items extend `FoodStore` in `src/game/foodStore.ts`, and the spoilage rules are in `src/game/food.ts`.
  - Gathering uses the existing gather action.
- **Saves:** bump `SAVE_VERSION` and add a `SAVE_UPGRADES` step that starts an existing camp with no field, no granary, an empty granary, no seed and no new tools (`src/game/saveUpgrades.ts`). Nothing the player has is removed.
- **Copy** is plain, warm and short, with no exclamation marks.
- **Coverage:** SonarCloud requires 80% coverage on new code, and `App.ts` is untested. Keep field, granary and bread logic in tested modules under `src/game/`, and keep DOM logic in tested helpers.
- The project passes `npm test && npm run lint && npm run build`.
- **Verification:** the plan includes a browser check, at desktop size, of the field art at each stage, the granary and its panel, and baking a loaf.

## What's left to the builder

- Exact costs, build times, action times and energy.
- The yield per strip, the granary's capacity, the grind ratio, the loaf's hunger value and how long it keeps, all tuned so one harvest is about one winter.
- Where the wild grain patch is and when it can be gathered.
- The day the grain ripens.
- Sprite design for the field stages, the stooks, the granary and the loaf.
- All copy wording and the journal entries.
- Whether the field is one structure with strip state, or four strip nodes.

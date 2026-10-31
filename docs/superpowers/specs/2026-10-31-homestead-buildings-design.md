# Homestead Buildings Design: House, Well, Vegetable Beds, Workshop

## Intent

Over many seasons the camp should grow into a homestead the player is proud of. The player should be able to *see* the change, and each step should feel earned. The user described three things they want from a few seasons in:

- **Accomplishment:** the homestead looks clearly different from the first camp.
- **Less daily grind:** the survival chores shrink.
- **New challenges:** the time saved goes to exploring new areas, taming animals and decorating the homestead. Those are later projects.

The user's rule on the grind: **a building existing must not magically remove a need.** Wood still burns and food still runs out. Effort shrinks only through improvements the player makes one by one: larger stores, more efficient harvesting, a draft animal doing the heavy hauling (later), and farming instead of foraging. The pack and the fibre stack were early steps of this kind.

This design covers the first homestead batch: the **house**, the **well**, the **vegetable beds** and the **workshop**. It fits the game's identity as a cosy camp builder rather than hard survival. Every feature here is judged by its charm, and nothing the player has built or planted is ever taken away.

## Order and dependencies

The batch is built as **three projects, each its own plan and PR, in this order**:

1. **The house:** moving in, the shelter becoming a woodshed, the fireplace feeding itself, and the campfire becoming optional.
2. **The well and the vegetable beds.**
3. **The workshop.**

After the batch come save migrations, then new areas with wild animals and pens, then decorating. That order is agreed and outside this design.

The growing-clearing project (`2026-10-30-clearing-growth-design.md`) already reserved ground for each building, in `CLEARING_STEPS[...].room` in `src/game/clearing.ts`:

| Clearing step | Building |
|---|---|
| North, far | House |
| East, far | Workshop |
| West, near | Vegetable beds |
| West, far | Well |
| South, near and far | Nothing yet. Kept free for a future field or paddock. |

Each building uses the existing `ground: StepId` mechanism: it can't be built until its step is cleared, and its site isn't drawn until then. That's the **space rule** the user agreed to: everything new either replaces something old in its spot or needs ground the player has cleared. Clutter stays under the player's control.

## Goals

- Each building is a visible milestone, and each one makes a daily chore lighter.
- Moving into the house is a memorable moment.
- The campfire stops being a daily obligation once the player lives in the house. It isn't simply duplicated.
- Vegetables become a steady food source that replaces wandering for berries, with light tending.
- The workshop's upgrades make gathering and hauling lighter.

## Non-goals

- Metalworking, ore, a forge or iron tools. These come with the new-areas project, where exploring finds ore. *(The user liked the idea. It's deferred, not rejected.)*
- The horse or oxen, the stable and pens. That's the new-areas project. The woodshed becomes the stable then.
- Decorating, and a thirst meter. Water exists only for the beds and cooking.
- A field. It comes later, on the south ground or in a new area.
- Save migrations. They're their own project (`2026-10-31-save-upgrades-design.md`). From version 23 on, each format change adds an upgrade step.
- NPCs. The homestead has no other people.

## Anti-goals

- **Punishing progress.** Building the house must never raise the player's wood needs. Two fires to feed would do exactly that, which is why the campfire becomes optional.
- **New daily chores.** The beds must not need watering every day, and the well must not add a meter to watch.
- **Losing things.** A withered crop keeps its seed. Nothing built or planted is taken away.
- **Clutter.** No building goes anywhere except its reserved ground or the spot of something it replaces.

---

## Project 1: The house

### Building it

- **The house** is a new building on the **north far** step (`ground: 'north-far'`). It's the batch's biggest build and should cost noticeably more than anything else: a lot of wood and stone, plus fiber for the roof. *(Exact cost and build time are the builder's call. They should feel like a milestone without a long grind.)*
- It requires the **finished shelter** (`shelterFinished`) **and the bed**, so the player has lived through the shelter's upgrades first and has a bed to move in. *(My call. The bed is optional today, and requiring it avoids a house with no bed.)*
- It's drawn as a proper small house, larger than the shelter, with a chimney, a door and a window. The window is lit at night while the survivor lives there.

### Moving in

- Moving in happens at the first nightfall after the house is built, or when the player first sleeps there. *(Which one is the builder's call. Pick whichever reads as a clear single moment.)*
- That moment brings a message. *(Agreed with the user while planning: the year journal is organised by season, so instead of a one-off moving-in entry, the house adds an autumn entry for a night by the fireplace.)* The original idea was a message and a **journal entry**. The wording is the builder's, but the meaning is: *the fireplace inside will keep you warm now, and the campfire is yours to light whenever you like.*
- **The shelter becomes the woodshed** at that moment. The shelter sprite is replaced by a woodshed sprite in the same spot, keeping the shelter's footprint. It may keep a hint of what it was.
- **The bed moves into the house.** It isn't rebuilt, and sleeping and resting happen at the house.

### The fireplace: what changes once the survivor lives in the house

**Naming.** A `hearth` already exists: the "Stone hearth" at the campfire (`BUILDINGS.hearth`, 150 s per log against 90 without). Every house owner has it, because the shelter's stonework requires it. The house's fire is therefore a **new fire, called the fireplace** in code and copy. The stone hearth stays with the campfire and keeps its bonus there. *(My call.)*

**Home.** Today `isAtCamp` is a radius of 4 around the campfire, and the house on the north far step is outside it. Living in the house adds a separate **"at home"** zone around the house. **Warmth, sleep, rest and cooking** move to it. The drying rack, fiber kindling, stores and building stay tied to the camp and clearing, as now. A survivor standing by a **lit campfire still gets warm** at night, because it's still a fire; it's just never required. Journal and cold-night triggers that check "at camp" should accept home as well. The builder settles each case and lists them in the plan. *(My call.)*

The campfire currently drives warmth, sleep, rest, wolves, storms and the cold night. Once the survivor lives in the house, **the fireplace takes over every one of those roles**:

- **Warmth.** At night, in or beside the house, a burning fireplace keeps the survivor warm, as the lit campfire does today. The campfire's warmth drain and its "unlit" warnings stop applying.
- **Sleep and rest** happen at the house, not near the campfire. `sleepBlocker`'s "Move closer to the fire" becomes "go home" in spirit. The builder words it.
- **Wolves.** Wolves don't trouble a lived-in homestead whose fireplace is burning. If the fireplace runs out of fuel on a winter night, the wolf rules apply as they do now to a dead campfire. *(My call: the rule keeps a consequence for an empty woodshed without adding a new one.)*
- **Storms and the cold night.** The house counts as shelter at least as good as the finished shelter. Its burning fireplace plays the part a lit campfire plays today.
- **Cooking** at the pot moves to the fireplace.
- **Stargazing** stays outdoors. It doesn't need the campfire lit.

### The fireplace feeds itself

- **It burns only at night.** The fireplace lights itself at nightfall, burns through the night, and is banked during the day, using no wood until evening. *(The user's choice. Burning around the clock would raise wood needs, which breaks the anti-goal.)*
- The fireplace **draws wood automatically** from the woodpile and the woodshed. The player never carries logs to it. This is the main chore the house removes.
- It burns **less wood per night than the campfire with the stone hearth** does today (150 s per log), because a fire indoors loses less heat. *(The exact saving is the builder's call. It should be noticeable but modest, for example a quarter less.)*
- If both the woodpile and the woodshed are empty, the fireplace burns down like a campfire does now, with the same consequences.
- The player can still add wood by hand from the bag, as a fallback.

### The woodshed

- The woodshed holds **noticeably more wood than the woodpile** (`BALANCE.woodpileCapacity`). *(Size is the builder's call, for example 24 against the woodpile's 12.)*
- The woodpile and woodshed together form the camp's wood store. Every wood spender already counts from stores anywhere (`availableWood`/`spendWood` in `src/game/wood.ts`), and that extends to the woodshed.
- Taking down the woodpile to free its spot is **not** part of this design. It can come later if space gets tight.

### The optional campfire

- The campfire stays in the clearing as an **optional fire circle**. The player can still light and feed it, and it still lights the clearing at night. Nothing depends on it.
- Any companion or friend behaviour tied to the campfire keeps working with it. *(The builder should check the companion code. If something needs a lit fire, decide whether the fireplace counts too, and note it.)*

### How the player learns this

1. The moving-in message and journal entry, described above.
2. **The fire status line** (`#fire-status`) shows the fireplace, not the campfire, for example *"The fireplace is burning · 18 logs in store"*. It warns only when the wood stores run low.
3. Nothing about the campfire nags once the player lives in the house.

---

## Project 2: The well and the vegetable beds

### The well

- The well is a building on the **west far** step (`ground: 'west-far'`), near the berry garden and the beds. It costs mostly stone, with some wood. *(Exact cost is the builder's call.)*
- **Drawing water** is one action at the well. A single bucket **waters every vegetable bed** at once.
- Water is also an ingredient for **new pot dishes**, at least a **vegetable stew** made from vegetables and water. *(Recipes beyond the stew are the builder's call. They should match the existing dishes' tone and stay within the rule that no dish beats rest and shelter as the way to recover.)*
- There is no thirst meter, and water is never a survival need.

### The vegetable beds

- The beds are their own building on the **west near** step (`ground: 'west-near'`). **The berry garden stays as it is**, beside them.
- **Three beds** *(my call)*, drawn as raised wooden-edged beds.
- **Crops:** a few hardy vegetables, such as potatoes, beans, cabbages and carrots. *(The final list is the builder's call. Three or four kinds, each with its own art.)*
- **Seeds:** building the beds gives the first seeds, and each harvest gives a seed back. *(My call.)*
- **Growing:** a crop takes **a few days** from sowing to harvest, not a whole season, so a bed gives several harvests a year. Sowing works from spring to autumn, and the beds rest in winter.
- **Winter:** a crop still growing when winter starts **pauses** under the frost. It neither grows nor dries through winter and carries on in spring. Nothing is lost. *(My call.)*
- **Harvests** go to the bag first, or to the larder like other food, and feed the pot dishes.

### Watering and drying

A bed counts as **watered** on any day it rains (`src/game/rain.ts`) or the player draws water at the well. It grows on watered days and dries out over the days without water:

| Days without water | What the player sees | What happens |
|---|---|---|
| 0–1 | Fresh, dark soil | Growing normally |
| 2 | Pale, cracked soil and drooping leaves | Still growing, as a clear warning |
| 3 | Wilted | Growth stops |
| 4 | Withered | The crop is lost. **The seed is kept**, so the player can sow again straight away. |

This was the user's choice: a visit every couple of days is enough, and one trip waters everything. Rain only falls in spring (about one day in three), so in summer and autumn the well does the work. The user knew this when choosing the thresholds.

---

## Project 3: The workshop

- The workshop is a building on the **east far** step (`ground: 'east-far'`), beside the toolshed. It requires the toolshed. *(Exact cost is the builder's call.)*
- It has its own panel of upgrades, made from materials the player already gathers. Each upgrade eases a chore and is made once:
  - **Saw:** felling a tree gives more wood. *(Amount is the builder's call.)*
  - **Handcart:** hauling is much lighter. *(My call on the mechanic: with the handcart, the survivor can bring a full load of wood or stone to camp without the bag limit. One concrete option is a cart parked at the forest edge that holds a fixed extra amount and empties into the stores in one action. The builder should settle the mechanic in that project's plan and keep it to one simple action.)* The horse or oxen will pull it later.
  - **Bed tools**, such as a hoe or watering can: tending the beds gets lighter, for example the beds hold water a day longer. *(The exact effect is the builder's call.)*
- **Metalworking** is deferred to the new-areas project.

---

## Constraints

- **Stack:** TypeScript, Phaser 3, Vite, Vitest (node environment), oxlint. Art is drawn in code in `src/art/` from the existing palette. No image files.
- **Patterns to follow:**
  - Buildings are `BUILDINGS` entries with `ground`, `prerequisite` and `cost`, sited through `CAMP_STRUCTURES`.
  - Stores use the `available*`/`spend*` helpers, which count from anywhere, bag first.
  - Saves are strictly validated per version.
- **Copy** is plain, warm and short, with no exclamation marks.
- Each project passes `npm test && npm run lint && npm run build`.
- **Verification:** each project's plan includes a browser check of the new art and panels at desktop size.

## What's left to the builder

- Exact costs, capacities, build and craft times, and how much the fireplace and saw save.
- The final crop list, the dish recipes and all copy wording.
- Whether moving in happens when the house is finished, at the next nightfall, or at the first sleep.
- The handcart's exact mechanic, kept to one simple action.
- Sprite design for the house, woodshed, well, beds and workshop, in the existing style.
- How the code represents "lives in the house", whether a progress flag or derived from the structures.

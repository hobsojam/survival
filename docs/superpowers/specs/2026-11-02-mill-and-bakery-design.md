# Windmill and bakery

## Intent

Once the grain field is up and running, bread is the last real chore in the year. A full granary means eight trips to the hand quern, each one turning two grain into a flour that takes up a bag space. Then come eight bakes at the fire, one loaf at a time. The windmill and the bakery take that work away. **The mill cuts out the grinding. The bakery cuts out the baking.** The harvest stays the same size. It just gets easier to live on.

These are also the first buildings of the homestead's next stage. They stand on a new, wider ring of cleared land, beyond the ground the camp has used so far.

## Goals

- **Windmill.** In one visit, it grinds everything in the granary into flour and keeps that flour at the mill, not in the bag.
- **Bakery.** It bakes one loaf each morning from the mill's flour and leaves it on a shelf for the survivor to pick up.
- **Outer nooks.** A third, outer step of clearing opens a small nook on the north and south sides. The windmill stands on the south outer ground, beyond the field and granary, so grain travels field → granary → mill in a line. The bakery stands on the north outer ground, beside the house.

## Non-goals

- **The harvest does not grow.** The granary still holds one harvest of 16 grain, which makes 8 flour and 8 loaves.
- **No new people.** The survivor does the baking. The morning loaf is theirs, made before the day begins.
- **No outer ground on east or west yet.** Those sides are kept for whatever the homestead grows into next.
- **The map does not grow.** The outer steps have to fit inside today's 40 × 30 map.
- **No automatic harvest.** Sowing, cutting and threshing stay as they are.

## Anti-goals

- **A food mountain.** The user's words were "we want it to make life easier, not create a food mountain". One loaf a day fills 50 hunger against a drain of about 30, so it makes for a comfortable winter, not a stockpile.
- **Making the old way obsolete or required.** The hand quern and baking at the fire keep working exactly as they do now. Someone who never builds the mill loses nothing they had before.
- **Bread going to waste unseen.** The bakery shelf is small, and the oven waits while it's full, so loaves never pile up and quietly go soft.

## Camp means cleared ground

Panel jobs work anywhere on cleared ground (`isInClearing`), which already follows the clearing's real shape. The windmill and bakery panels follow the same rule, and so does any new ground the outer steps clear. Only jobs done at the fire (cooking, sleeping, tending it) need the survivor beside the fire. PR #117 brought the drying rack and the cooking refusal into line with this.

## The outer nooks

- **Two new steps.** `north-outer` and `south-outer` are the third step on their sides, and each needs that side's far step cleared first. They work the same way as today's steps: mark the step, fell its trees, then clear the ground for wood, fiber and stone.
- **Nooks, not a ring.** Each step clears a small nook just big enough for its building. It runs out to about 11 tiles at a narrow angle beyond the far ground, not the whole side. The rest of that side keeps its far reach.
- **The woods stay wild.** The user's ruling: no wild grain and no forest trees inside camp.
  - No forage spot (wild grain, hazels, honey tree, pine needles, berries, greens) may fall inside even the fullest clearing.
  - No wild tree (`state.trees`) may either.
  - Each nook sits in a gap between them.
- **Room lists.** `north-outer` makes room for the bakery, and `south-outer` for the windmill.
- **Cost.** My call: 8 wood, 4 fiber and 2 stone, with 3–4 trees, since the nook is small.
- **Later, perhaps.** A straw beehive beside the bakery came up as an idea for a future round. It is not part of this one.

## Windmill

- **Where and what.** It stands on `south-outer` and needs the granary. As a late building it costs about as much as the house. My call: 12 wood, 4 fiber and 10 stone.
- **Mill the grain.** One action, done from the Windmill panel anywhere in camp, grinds all the granary's grain into flour, at 2 grain per flour. An odd grain stays in the granary. The flour goes into the mill's flour bin.
  - **Bin.** The bin holds up to 8 flour, one granary's worth. If the bin is nearly full, it grinds only what fits.
  - **Time.** The action takes noticeably longer than a gather but far less than eight of them. My call: one heavy job, like a field job (12 seconds, 8 energy).
- **Flour at the mill.**
  - It keeps, like kept food.
  - While the survivor is in camp, baking a loaf at the fire can use it, the same way a larder within reach counts.
  - The bakery draws on it each morning.
  - It never takes a bag space.
- **The hand quern.** It still grinds 2 grain into one flour in the bag. The mill doesn't need the quern.
- **Which flour a fire bake uses.** My call: the bag first, then the larder, then the mill, so flour that takes up room gets used before flour that doesn't.
- **Art.** A small windmill with sails that turn. It's the first thing in camp you can see moving from a distance.

## Bakery

- **Where and what.** It stands on `north-outer` and needs the windmill. My call: 10 wood, 2 fiber and 10 stone.
- **The morning loaf.** Each dawn, if the mill's bin has at least one flour and the bakery shelf has room, one flour becomes one loaf on the shelf. The loaf's bake day is the new day. My call: it bakes wherever the survivor is that morning, at camp or away.
- **The shelf.**
  - It holds **2 loaves**. While it's full, the oven waits and uses no flour.
  - Loaves on the shelf go soft by the larder's rule: five dawns after baking.
  - A loaf moved into the bag keeps its bake day, and the bag's three-dawn rule applies from then on, the same way loaves already move between the bag and the larder.
- **Taking a loaf.** The Bakery panel has a Take button that moves one loaf into the bag, if there's room. It works anywhere in camp, like the other panels. Eating straight from the shelf is left to the builder.
- **Morning line.** On a dawn that bakes, the morning line can mention it. My call: "Fresh bread from the oven this morning." It should be written once in a while, not every morning. The builder settles how often.
- **Charm.** A little smoke from the bakery chimney on mornings it bakes.

## Elsewhere

- **The forecast's "food laid by".** It counts the mill's flour and the loaves on the shelf, as it already counts grain and flour.
- **Saves.** The save version goes up one. An upgrade step adds the new steps' state, the mill bin (0), the shelf (empty) and the buildings (not built). Validation covers bin limits, shelf limits, loaves' bake days, and the rule that buildings need their ground and prerequisite.
- **The journal.** One new line for the bakery is welcome, but it's optional and up to the builder. A suggestion: "Woke to warm bread from my own oven." Its season and its own icon are the builder's call.
- **The README.** A section after "Grain field and granary".

## Left to the builder

- The exact costs, reaches, tree lists, time and energy, and sprite designs.
- How the Windmill and Bakery panels look, following the field and granary panels.
- How often the morning line appears.
- Whether there's a journal line.

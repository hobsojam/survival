# Beehive

## Intent

Honey today comes only from the wild hollow tree north of camp, and only in summer: one honey, then three dawns before the bees have more. Summer is the season that needs extra food least. The user's words: "we dont need more food in summer so a little extra in winter makes sense". A beehive of the survivor's own gives **honey all year**, so a little honey, and the odd honey cake, reaches the winter table.

It's also one more homestead building on the north ground, beside the bakery.

## Goals

- **The hive.** A straw skep the survivor builds on the north outer ground, beside the bakery.
- **Honey all year.** The bees make one honey every three dawns in every season, winter included.
- **Taking honey.** A Beehive panel takes the waiting honey into the bag, anywhere on cleared ground, like the bakery's loaf.

## Non-goals

- **The wild honey tree is unchanged.** It still gives honey in summer only, on its own three-dawn regrowth.
- **No beekeeping chores.** There's nothing to feed or tend and no swarms, and the bees don't sting.
- **No new food or dish.** Hive honey is the same honey item, with the same hunger, energy and honey cake recipe.

## Anti-goals

- **A food mountain.** The hive holds at most **2 honey**. While it's full the bees wait, so honey never piles up out of sight. Over a ten-day winter that's about 3 extra honey, roughly 60 hunger: a small help, not a stockpile.
- **Making the wild tree pointless.** In summer both give honey. The hive is mostly felt in the other seasons.

## The hive

- **Where.** On the `north-outer` ground (add `'beehive'` to its room list), beside the bakery. If the nook is too narrow for both, the builder may widen the nook's arc. The user's rule still holds: no forage spot and no wild tree inside the clearing, and the existing tests check that. If that fails, the hive may stand on the north far ground instead. Either way it sits on cleared ground and clear of other buildings' art.
- **Prerequisite.** My call: none beyond its ground. Anyone who has cleared the north nook can keep bees, with or without the bakery.
- **Cost.** My call: 4 wood and 6 fiber, no stone. A skep is mostly woven straw.
- **Name and symbol.** "Beehive", "Keep bees for honey all year". The symbol is the builder's call.

## The honey

- **Making it.** At a dawn, if three or more dawns have passed since the hive last made honey, and the hive holds fewer than 2, it makes one honey. It works in every season and whether the survivor is at camp or away. The first honey comes three dawns after building. The exact bookkeeping is the builder's call. A "next honey day" is the obvious one, and while the hive is full it should wait rather than bank days.
- **Keeping.** Honey is kept food, so honey in the hive never spoils.
- **Taking it.** The Beehive panel shows how much honey is waiting ("1 of 2 honey") and has a Take button. Take moves **all** the waiting honey into the bag, as far as there's room.
  - If the bag has room for only one, it takes one and leaves the rest.
  - Refusals, in order: 'Build the beehive first.', 'Return to camp to take the honey.' (off cleared ground), 'The bees have no honey for you yet.', 'Make room in your bag for the honey.'
  - It takes no time, like taking a loaf.
- **Eating and cooking.** Honey in the hive is not reachable for eating or cooking until taken. It's unlike the mill's flour, because honey isn't a step in any chain.

## Elsewhere

- **The forecast's "food laid by".** It counts honey waiting in the hive, as it counts loaves on the bakery shelf.
- **Saves.** The save version goes up one. An upgrade step adds the building (not built) and the hive's state (empty). Validation covers the honey count (an integer from 0 to 2, and 0 unless the hive is built) and the bookkeeping day.
- **Art.** A small straw skep. By day, a bee or two drift around it, fewer in winter, and none at night.
- **Journal and morning line.** These are optional and the builder's call. A morning line on the first honey could be "The bees have made honey."
- **README.** A short "Beehive" section after "Windmill and bakery", and the "food laid by" line gains the hive's honey.

## Left to the builder

- Exact placement, the sprite, and how the bees move.
- The panel's look, following the bakery panel.
- Whether there's a journal line or a morning line.

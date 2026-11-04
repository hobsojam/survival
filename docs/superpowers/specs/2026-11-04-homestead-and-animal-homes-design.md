# Homestead and animal homes

## Intent

Make the wilderness feel more like a place the survivor can care for. An abandoned homestead adds a playable trip to bring a surviving flock of chickens home. Existing bird, fox, and wolf friendships may all coexist, and each can have a cosmetic home beside the player's house.

## Goals and constraints

- Keep the game's gentle survival tone. Chickens never die or leave because grain runs out, and there is no rescue timer.
- The new homestead is a fixed area connected to camp by a walkable path. Time and needs keep running there, as at the quarry. The player walks the flock home in normal play; chickens are never inventory items.
- Finding the chickens unlocks a coop. It can be built before the house, and the flock follows only after the coop is ready. A small amount of feed at the old homestead starts the escort; the player does not need harvested grain.
- The flock settles at the coop. Stored granary grain is consumed automatically when available, yielding eggs more often. With no grain the chickens forage, produce fewer eggs, and stop laying in winter. Eggs are collected at the coop and cooked at a fire into a one-egg omelette, with no other ingredients.
- The homestead has autumn apples to gather on repeat visits and a small shed with a one-time useful find.
- The bird, fox, and wolf can each become friends through their existing offerings. Existing benefits work together. After the house is built and each animal is befriended, the player may separately build a birdhouse, wolf house, and fox den at fixed positions near the house. These are cosmetic and do not affect friendship, abilities, or happiness. The den is a shallow hollow lined with branches and fiber; no new tool is needed.
- Existing version 23+ saves continue loading. A previous sole friend remains befriended, and new progress starts empty. No secret content is added to player-facing documentation.

## Non-goals

No animal happiness, breeding, death, carrying, combat, player-placed structures, complex recipes, or cutscenes.

## Approaches

For animal homes, the choices were three independent builds and one shared animal corner. The player chose independent builds so the camp grows with each friendship. For the homestead's repeat visit, the choices were orchard, overgrown garden, and one-time shed only. The player chose the seasonal orchard with a small shed. The chicken journey is a playable escort rather than a scene transition.

## Builder calls

The homestead path opens with the shelter, matching the quarry. Chickens regroup at crossings and cannot get permanently stuck. The coop and homes use existing wood and fiber. Eggs and apples are fresh food that spoil under existing rules; a coop holds up to three eggs. Grain is spent only on laying days, at most one unit per egg. Egg production is one egg every two dawns with grain, every four dawns without it outside winter, and zero in winter without grain. Apples regrow in autumn after three dawns. The shed yields a small one-time bundle of wood and fiber. The implementation should use existing build, journal, save, and scene patterns and avoid new dependencies.

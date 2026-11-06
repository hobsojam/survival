# The Hills Design

## Intent

Give the player somewhere new to go that isn't about food: low hills past the quarry, with ore in the rock and a wild pony to win over. The ore leads to a forge, added to the workshop, and the forge makes the pony's horseshoes and a better pickaxe. After that the pony walks beside you with a load on its back.

It's a place to walk to, a friend to make and a small step up in what the camp can do. It also lays the ground for the stone tower, which comes next and will use the forge.

## Goals

- The first walk up feels like finding somewhere new, and the hills look different in each season.
- Winning the pony over is a slow, small pleasure, like the fox, the wolf and the bird.
- Walking home beside a loaded pony is the picture the feature is built around. *(The user chose walking beside it over riding.)*

## Non-goals

- Riding, stables, pony feed or breeding.
- New crops or food to gather. *(The user: "its starting to feel like we are turning into a farming simulator.")*
- New rabbit art or behaviour. The hills reuse the meadow rabbits as they are. *(The user: "dont reinvent them with new art. use what we have".)*
- Other people, trading, or selling ore or animals.
- A long list of forge products. The gate, the iron pot and other ideas raised along the way are out. Fittings for the tower belong to the tower's own design.

## Anti-goals

- **A farm or a chore.** The pony grazes for itself and is never fed. The forge burns no fuel and needs no looking after. Forgetting either costs nothing.
- **A loss.** The pony can't get ill, die, run off or lose trust. Ore doesn't go off.
- **Danger.** The hills are no more dangerous than the quarry. No falls, no storms of their own and no special cold.
- **A grind.** Horseshoes and the iron pickaxe are each made once. A couple of trips should be enough to make both.

## The player's path

1. With the quarry found, a new path opens from the quarry's far side to the hills.
2. On the first visit, the player finds rust-red streaks in a rocky outcrop near the top, and sees a shaggy pony grazing that moves off if they come close.
3. They chip out ore with the pickaxe they already have, and carry it home. It has no use yet, and a line says so.
4. Having found ore, they can add a **forge** to the workshop.
5. Over several days they offer the pony food. Once it trusts them, it follows them home and stays around camp, and they can name it.
6. At the forge they make **horseshoes**. From then on the pony comes on trips, carrying extra.
7. They also make an **iron pickaxe**, in either order.

## The hills

- A new area, `hills`, the same size as the others, reached only through the quarry. Its one exit leads back there. So the walk from camp crosses the whole quarry first, and it should feel like a trip.
- Low, rounded ground: short grass, heather, bracken, gorse and a few small wind-bent hawthorns and rowans near the bottom of the path, with none at the top. Bare rock shows through near the top.
- All of this is scenery. None of it is gathered and it doesn't take wood from the woods.
- **Seasons show clearly:** gorse flowers yellow in spring, heather is purple in summer, bracken is rusty in autumn, and snow lies over everything in winter.
- **Rabbits:** the existing rabbit sprite and behaviour, in spring as in the meadow, at a few new spots on the slope.
- The path stays open in every season.

## Ore

- **Needs:** the pickaxe, standing at the outcrop, and room in the bag. The refusals match the quarry face's.
- **Weight:** ore is heavy, and takes the same bag spaces as stone (`BALANCE.stoneSpaces`).
- **Supply:** the outcrop gives **3 ore** a day, one per go, then says it's worked out until morning. *(My call. The quarry face gives one or two a day, but this is a long walk and a one-lump trip would feel like a waste.)* The same time and energy per go as digging at the quarry.
- **Storing it:** ore shows in the Bag while carried. Once the forge stands, ore is moved into it whenever the player is in the clearing, up to **12**, the way the other camp stores work. *(My call.)* Extra ore stays in the bag and can be dropped as stone can.
- Before the forge exists, the first ore gets one line saying there's nothing to do with it yet.

## The forge

- **An upgrade, not a building:** the forge is added to the workshop from the Workshop panel, like the saw and the handcart. *(The user's choice. There's little room for a separate building on that ground, and it adds no new panel.)*
- **Cost:** **2 wood and 6 stone**. *(My call.)*
- **Needs:** the workshop built and ore found. Until ore has been found, the forge doesn't appear in the panel, so nobody builds it without a reason.
- **No new ground:** no new clearing step, and the handcart and loom stay where they are.
- **Look:** the workshop's picture changes: a stone lean-to on one side, with a chimney, an anvil and a warm glow from the coals. Drawn in code.
- **What it makes,** each once, listed in the Workshop panel once the forge is added:

| Item | Cost | Effect |
|---|---|---|
| Horseshoes | 2 ore, 1 wood | The pony can leave camp and carries a load |
| Iron pickaxe | 3 ore, 1 wood | Each dig at the quarry face gives 2 stone instead of 1 |

- **Iron pickaxe detail:** it replaces the old pickaxe. A dig needs room for at least one stone, and if there's room for only one, that's what you get. The face's daily limit doesn't change, so the mine's second dig also gives 2. It doesn't change ore or rubble. *(My call, so the pickaxe doesn't shorten the trips to the hills.)*
- Ore costs are small on purpose: 5 ore in all, or two trips. Further ore only matters once the tower exists.

## The pony

**Wild, on the hills:**
- It's always there by day, grazing near the top. If the player comes too close, it ambles a few tiles away, and that never costs the day's offer. It doesn't flee for the day as the fox does, because losing a day after that long walk would be annoying. *(My call.)*
- The player can offer it an **apple or vegetables**, one offer a day, in any season, from just outside the distance that makes it move. A tap on it walks the survivor into offering range and stops there, so the gesture works on a phone. *(Apples alone would have tied this to autumn.)*
- It takes **4 offers** to win it over, the same as the fox. *(My call.)*

**Won over, unshod:**
- It follows the survivor at walking pace to the camp, then stays around the clearing, grazing in a spot that doesn't block anything.
- It won't leave camp again while unshod. A line explains why the first time: its hooves can't take the stony path.
- It can be named in the usual way, with the prompt when it's won over and by tapping it later if unnamed. Named, it appears in morning notes alongside the other animals.

**Shod:**
- It walks with the survivor by day to any area, at the survivor's pace, with visible packs on its back.
- It adds **8 bag spaces** while it's with the survivor. *(My call. That's half a woven pack, and it's enough to matter on a trip.)* Those spaces work as part of the bag, with no separate pony inventory.
- **Winter:** it stays out of the hills in snow. It walks with the survivor everywhere else. If the survivor enters the hills in winter, it stops at the quarry end of the path and waits there. Its spaces are lost while it's apart from the survivor.
- **Over the limit:** if a bag holds more than its capacity because the pony isn't there, nothing is lost. The bag just can't take anything more until there's room.
- **Night:** it goes back to camp at nightfall as the other friends do, and is at the survivor's side again next morning.

The pony isn't a source of gifts or keepsakes.

## Journal and notes

- **Journal:** one line per season for being up in the hills, about what's showing that season: gorse, heather, bracken, snow. They stay off the pages until the hills are found, so they never show as blanks before that. `WAITS_ON` only accepts buildings today, so it needs to accept this condition too. *(My call. The journal is seasonal, so one-off firsts don't fit it.)*
- **Morning notes** carry the firsts, once each: the first ore, the pony won over, and the first morning after shoeing. A few named notes for the pony join the existing ones.
- Copy is plain and warm, not poetic, and has no exclamation marks.
- The hills, forge and pony belong in the README. They aren't easter eggs.

## Save format

This changes the saved shape, so it takes `SAVE_VERSION` **37** with an upgrade step, and it must be the only open PR doing so. Existing saves begin with no hills found, no ore, no forge, no pony and the current pickaxe.

Validation should reject impossible states, such as a shod pony that isn't won over, a forge without a workshop or found ore, horseshoes or an iron pickaxe without a forge, an iron pickaxe without the first pickaxe, or forge ore above the limit.

## Constraints

- TypeScript, Phaser 3, Vite, Vitest and oxlint, with no new dependencies and no image files.
- Follow the existing patterns: `AreaId` and `crossing` for the area, `applyAction` handlers, `pickTapTarget`, `prompts.ts`, `newsBetween`, `JOURNAL_PAGES` and `JOURNAL_ICONS`, `names.ts` for naming, `WORKSHOP_UPGRADES` for the forge and its items, and `src/ui/panels.ts`.
- SonarCloud needs 80% coverage on new code and `App.ts` is untested, so keep logic in tested helpers.
- Everything is reachable by tap as well as by keyboard, and every path must still work when the survivor is weak.
- Verify with `npm test`, `npm run lint` and `npm run build`, plus a browser check at desktop and phone sizes that plays the real path: walking to the hills, digging ore, winning the pony, adding the forge by pressing its real button, and walking home with a loaded pony.

## Left to the builder

- The hills' layout, the outcrop's and pony's positions, and the rabbit spots, as long as the path up reads clearly and the survivor can walk around everything.
- How the pony and the workshop's forge are drawn, as long as the pony reads as small and shaggy and the load is clear at game scale.
- Whether the pony extends the `Friend` type or sits beside it, as long as it doesn't start giving gifts or keepsakes.
- Which side of the workshop the forge goes on, as long as it doesn't cover the handcart, the loom or anything else that already exists.
- Small numbers, as long as both forge items take no more than a few trips.

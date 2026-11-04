# Sheep and Wool Design

## Intent

Give the homestead animals you look after and something funny to look at. You feed the sheep, you can shear them once a year, and if you never do, they slowly become giant fluffy clouds. It stays one survivor's quiet place: nobody sells you the sheep, and nothing bad happens to them.

**The joke matters as much as the wool.** Not shearing is never a failure. A player who only ever keeps clouds is playing properly.

## Goals

- Feeding is a small, pleasant job you choose to do.
- Shearing is one event a year, and the sheep shrinking back to skinny is the funniest moment of it.
- A flock left alone grows into visibly absurd clouds over a few years.
- Wool gives a reason to build a loom, which makes a few useful things.

## Non-goals

- Lambs, breeding, a growing flock, or sheep as food.
- Sheep getting ill, leaving or dying, and wolves bothering them.
- Spinning yarn as a separate step.
- Buying sheep, traders, or any other people.
- A new area. The hills are the next project, and these sheep only hint at them.

## Anti-goals

- **A new daily chore.** Missing feeds costs nothing but slower fluff.
- **Free wool storage.** A shearing gives the same wool however fluffy the sheep are, so leaving them unshorn never saves wool up. *(The user's ruling.)*
- **A food competitor.** Feed must not take grain from bread or the chickens.
- **Clutter.** The pen stands only on ground the player has cleared for it.

## The player's path

1. Clear the new ground and build the **sheep pen**. It needs the grain field, because feed comes from threshing.
2. Thresh a strip to get straw, then **put out feed** at the pen.
3. At the next dawn, three stray sheep are standing in the pen, and they stay for good. A morning note says so: "Three sheep were in the pen this morning. They seem to have decided something."
4. Make **shears** at the workshop. This is optional.
5. In spring, **shear the flock**. The first shearing makes the **loom** appear in the build list.
6. Make the **blanket**, **jumper** and **rug** at the loom.

A player who never makes shears never sees the loom, and keeps clouds instead. *(The order of sheep before loom, and the sheep wandering in, are the user's decisions.)*

## Feeding

- Threshing a strip now also gives **2 straw**, whether or not the granary has room. This gives the existing "the rest stays as straw" line a use. Straw counts from the moment the field exists, even before the pen.
- Straw is kept at the field and takes no bag space. It holds up to **12**, and anything beyond that is lost without comment.
- **Put out feed** is a button in the Sheep panel in the Camp tab, usable anywhere in the clearing. It costs 1 straw and the same time and energy as gathering.
- A feed lasts **3 dawns**. Feeding again before it runs out is refused: "The sheep still have plenty."
- The sheep trot to the rack when they're fed, then wander off again.

## Fluff

The flock shares one fluff count, and all three sheep look the same.

- Each dawn adds **2** fluff while they're fed, or **1** while they're not, up to a cap of **200**. They graze for free when unfed.
- Sheep arrive at **40** fluff, so they can be sheared in their first spring.

| Fluff | Look |
|---|---|
| 0–39 | Skinny, just shorn |
| 40–119 | Normal and woolly; can be sheared |
| 120–199 | Very round |
| 200 | Giant cloud with tiny legs and a small face peeking out |

That makes a cloud about 2.5 years of feeding after a shearing, or 5 years with none. The cloud is the largest they get, and they waddle slowly. In winter, each sheep wears a little cap of snow.

## Shearing

- **Needs:** the shears, spring, at least 40 fluff, and no shearing yet this year. The Sheep panel gives the reason whenever it's blocked.
- **Work:** one heavy job for the whole flock, the same as a field job (12 seconds, 8 energy), so being exhausted blocks it until you've rested.
- **Result:** **4 wool**, always, whatever the fluff. Fluff returns to 0, and the sheep are visibly skinny straight away.
- **Wool store:** the basket holds **8 wool**, about two years' worth, and takes no bag space. It sits at the pen until the loom exists, and the loom then uses it. If there's no room, the shearing still happens and the extra is lost, with a line saying so.
- **Journal:** one new spring line, with a variant for shearing a cloud. It is off the page until the pen stands, using the existing `WAITS_ON` mechanism:
  - "Sheared the flock. They looked smaller and rather cross."
  - "Sheared the cloud. There was a sheep in there after all."

## The loom

Appears in the build list after the first shearing. Items are made once each, from a Loom panel in the Build tab, anywhere in the clearing, with the same time and energy as a workshop upgrade. Wool always comes from the basket.

| Item | Wool | Effect |
|---|---|---|
| **Wool blanket** | 3 | Resting in the bed restores 10 more energy, on top of the feather pillow. Needs the bed. |
| **Warm jumper** | 4 | You lose a tenth less warmth at night, wherever you are, on top of the fur cloak. It isn't drawn on the survivor. |
| **Rug** | 3 | Decoration only. It lies by the house door, because the house has no drawn interior. Needs the house. |

Once all three are made, the loom's panel says so, and wool has no further use. The sheep are just company from then on.

## Place and art

- **Pen:** a **6 × 5 tile meadow** at x 31–37, y 2–7, up past the lookout and reached along its path. It is roomy enough that three clouds never look cramped; the user ruled out a small pen because crowded sheep would look cruel.
- **The ground:** a new **east outer** step: 8 wood, 4 fiber and 2 stone, 3 trees, and it needs `east-far`. Unlike the other steps it clears a separate patch rather than a wedge from the fire, because every wedge large enough would swallow something wild. The patch stays grass, not earth, and counts as cleared ground for panels and building. No wild thing has to move.
- **Pen cost:** 8 wood and 4 fiber. **Shears:** 1 wood and 2 stone, a workshop upgrade needing the pen. **Loom:** 8 wood, 2 fiber and 2 stone, on the east far ground beside the workshop.
- **New art, drawn in code:** the pen with a gate and a feed rack; three sheep looks, each with idle and walk frames; the cloud look; a snow cap; the loom; the rug.
- Sheep wander inside the pen as a scene effect. Tapping them does nothing new.

## Save format

This changes the saved shape, so it takes the next unused `SAVE_VERSION` and adds an upgrade step, and it must be the only open PR doing so. Existing saves start with an unbuilt pen and loom, no shears or woven items, no sheep, no straw and no wool. Validation should reject impossible states, such as sheep without a pen, a loom before the first shearing, or an item without its wool having been possible.

## Constraints

- TypeScript, Phaser 3, Vite, Vitest and oxlint, with no new dependencies and no image files. Follow the existing patterns: `BUILDINGS`, `CLEARING_STEPS[...].room`, workshop upgrades, and panels in `src/ui/panels.ts`.
- SonarCloud needs 80% coverage on new code and `App.ts` is untested, so keep DOM logic in tested helpers.
- Copy is plain, warm and short, with no exclamation marks. This belongs in the README; it is not an easter egg.
- Verify with `npm test`, `npm run lint` and `npm run build`, plus a browser check of the art and panels at desktop and phone sizes. Check a cloud in particular, since it's the point of the feature.

## Left to the builder

- The exact numbers above, as long as no path becomes a grind and a cloud stays years away.
- The nook's exact shape and the pen's spot, within the rules above.
- How the sheep are drawn and wander, as long as the cloud is unmistakably funny.
- Whether this ships as one PR or a few. The pen, sheep and fluff could go first, with shearing and the loom after, as long as each works on its own.

# Orchard Design

## Intent

Let the player pick apples from trees they grew themselves. Today the only apples are on the old homestead tree, a walk from camp. Saving the pips and planting them means that, years later, there are apples at home.

It's a slow, quiet reward, and it suits the camp slowly becoming a homestead. The picking is the point. *(The user's words: "picking apples? what else would you do in an orchard?")*

## Goals

- A player who plants a pip sees a tree that visibly grows, year by year.
- There's a real moment when the first apples come: one autumn, on your own tree.
- Planting is a few small acts that then look after themselves.

## Non-goals

- New kinds of fruit, cider, selling or trading.
- Grafting, pruning, varieties or pests.
- Other people, or anything else that makes this a farm job.
- Any change to the old homestead tree, which keeps working as it does.

## Anti-goals

- **A chore.** Trees need no watering or care. A player who forgets the orchard for two years comes back to bigger trees.
- **A loss.** Trees can't die, sicken or be eaten. Unpicked apples cost nothing.
- **A wait that looks broken.** A tree must look different each year. A sapling that looks the same for years would read as a bug.
- **A cure for winter.** Orchard apples are the same fresh apples and spoil the same way, so they make autumn richer without removing the pressure of a hungry winter.

## The player's path

1. Pick apples at the homestead as now. **Eating or cooking an apple saves its pips**, one per apple. The first time, a line says so: "You keep the pips."
2. Clear the new **west outer** ground and build the **orchard**: a small fenced plot with six marked spots.
3. Stand by an empty spot and **plant a pip**.
4. Come back over the years to find the trees larger.
5. At the third autumn after planting, the tree has apples. A morning note marks the first time: "There are apples on your own tree this morning."
6. **Pick apples** there, as at the old tree.

## Pips

- Pips take no bag space and show as a row in the Bag tab once you have one.
- A rotten apple gives none. Only one eaten or cooked does, including cooking in a pie or baking.
- Apples from your own trees give pips too.
- There's never any use for more pips than empty spots, so saving stops once pips held plus trees planted reach **6**, with no message after the first.

## Planting and growth

- **Six spots.** *(My call. The user left it open between a handful and a proper orchard, and six reads as a small orchard without crowding the map.)*
- **Planting:** costs 1 pip and the same time and energy as gathering. It works in any season but winter: "The ground is frozen hard."
- **Growth** goes by autumns passed since planting, worked out from the planted day and the calendar. The year starts in autumn, and a year is 40 days. So the wait is between just over 2 years and 3 years, depending on when you planted.

| Autumns passed | Look |
|---|---|
| 0 | A sprout with a stake |
| 1 | A thin sapling, taller than the survivor's knee |
| 2 | A young tree, which blossoms in spring but bears nothing yet |
| 3 or more | A grown tree that bears apples each autumn |

- **Seasons show on any tree old enough:** bare in winter with a little snow, blossom in spring, green in summer, turning in autumn.

## Picking

The same rules as the old tree, per tree:

- **Needs:** autumn, a grown tree with ripe apples, and a space in the bag. The refusal lines match the old tree's, such as "Make room in your bag for an apple."
- **Result:** 1 apple, and that tree is ripe again after 3 dawns, so each tree saves the day it's next ripe. The same time and energy as the old tree.
- A tree is ripe from the start of its first bearing autumn. *(My call.)*
- A ripe tree shows apples on it, so you can see from a distance what's ready.

## Place and art

- **Ground:** a new `west-outer` clearing step needing `west-far`, costing the same as the other outer steps. Like `east-outer`, it clears a separate grass patch rather than a wedge, and no wild thing has to move. Its `room` is `['orchard']`.
- **Orchard:** a new building, 6 wood and 2 fiber, in the Build tab. It needs the homestead to have been found, so nobody builds it before they've seen an apple.
- **New art, drawn in code:** the fence and marked spots, and the tree at every age and season above.
- Trees and spots are tapped like other things, through `pickTapTarget`, and listed in the on-screen prompts. A tap on a tree or spot walks there and acts.

## Journal and notes

- One morning note the first time any tree of yours bears.
- One new autumn journal line, off the page until the orchard is built, using `WAITS_ON`: "Picked an apple from a tree I grew myself."
- Copy is plain, warm and short, with no exclamation marks.
- The orchard belongs in the README. It is not an easter egg.

## Save format

This changes the saved shape, so it takes the next unused `SAVE_VERSION` (36 at the time of writing) with an upgrade step, and it must be the only open PR doing so. Existing saves start with no pips, no orchard and no trees. Validation should reject impossible states, such as more than six trees and pips together, a tree without the orchard, a planted day in the future, or a tree planted in winter.

## Constraints

- TypeScript, Phaser 3, Vite, Vitest and oxlint, with no new dependencies and no image files. Follow the existing patterns: `applyAction` handlers, `BUILDINGS`, `CLEARING_STEPS` with a `patch`, `pickTapTarget`, `newsBetween`, `JOURNAL_PAGES`, and panels in `src/ui/panels.ts`.
- SonarCloud needs 80% coverage on new code and `App.ts` is untested, so keep logic in tested helpers.
- Verify with `npm test`, `npm run lint` and `npm run build`, plus a browser check at desktop and phone sizes: planting a pip, a tree at each age and season, and picking from a grown tree.

## Left to the builder

- The patch's exact place on the west side and the layout of the six spots, as long as trees have room to look like an orchard, the survivor can walk among them, and nothing wild has to move.
- How the trees are drawn, as long as each age is obviously different from the last.
- Small numbers, as long as the first apples stay more than two years away and no step becomes a grind.

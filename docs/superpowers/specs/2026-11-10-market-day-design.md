# Market Day Design

The town's last slice. It builds on `docs/superpowers/specs/2026-11-08-town-design.md` ("Market day and the finish", "The hook") and settles what that design left open: what market day looks like, how often it comes, and how the first one ends the town.

## Intent

By now the survivor has spent years building, and has handed their chores, one by one, to neighbours. Market day is the payoff, not another job. *"I imagine by now the survivor is mostly admiring what they have built and now finally sees life."* *(The user.)* On market day there's nothing to do. The survivor walks through the square and the town and watches the place they made come alive.

## Goals

- **The finish.** The first market day is the town's finish. It's felt, not announced: there's no "you win" screen, and the game carries on. *(The user accepted this.)*
- **A town that stays alive.** Market day keeps coming back, so the finished town still has a reason to visit and still feels lived in.
- **The year shows in the stalls.** Each market shows what the town actually made that season.
- **The quiet hook.** The first market brings the glass lens, the first hint of the palace and its observatory.

## Non-goals and anti-goals

- No money, prices, shops, trading screen or bargaining. Market day happens, and things arrive. *(From the town design, which the user approved.)*
- No tasks, prompts to work, materials or timers on market day. Missing a market costs nothing.
- Market day is never needed for anything already in the game. The traders' goods have no use yet.
- No pop-up warnings. The player learns about a market from what they see in the world. *(The user: "warning isn't the right term. More like a sign up advertising it.")*
- Nothing about the palace shows apart from the lens.
- No new crops or gatherable foods.

## How it works

### When

- **The square opens** once the town is as full as it can get: every finished house is lived in, every stall has a keeper, no job is left to offer, and no house is open to build. *(The user agreed.)* This replaces the town design's "every house is full": several camp jobs only exist if the player built something optional (the orchard, the field, the sheep), and a house only opens while a job is free, so some players can never fill all 15 plots. If a player later builds something that frees a job, a newcomer still comes and the town grows. The square stays open, and markets carry on.
- **The road comes first.** The first market also waits until the meadow's old road is cleared and its milestone set, since that's the road the traders come in by. *(The user agreed.)* While the town is full but the road isn't ready, there's no sign. Instead, stallholders mention it as the survivor passes, something like "The traders won't come while the old road's grown over.", so the player knows what's holding things up.
- **Saving it.** No "square open" state exists yet. The open day (or the first market day) is saved, and validation rejects it before the conditions above were met, or before the road and milestone were done.
- **Every fifth day.** Market day comes every fifth day: twice a season, eight times a year. It's the town's "week". *(The user agreed.)* The first market falls two dawns after the square opens: the sign goes up the next day, and the market is the day after that. Later markets follow every fifth day after the first, counted from the first market, not from the calendar. *(My call.)*
- **One day long.** A market lasts from dawn to dusk. *(The user agreed.)* A day is about five and a half real minutes, three and a half to four of them daylight.

### The sign

*(The user accepted this.)*

- On the day before each market, a stallholder puts up a painted board in the square, leaning against the well. It advertises the market tomorrow.
- On market day it's turned to show the market is on today. The next dawn it's gone.
- Pixel art can't hold readable words, so when the survivor stands by the sign, it says what it says in the same way other nearby things show a line: "Market tomorrow" the day before, and "Market today" on the day. The exact wording follows the copy rules. *(My call.)*
- Townsfolk may mention it as the survivor passes: "Market tomorrow." on the eve, and something like "Busy one today." on the day, in place of their usual greeting. *(My guess, accepted.)*

### The stalls

- Each stall shows what its keeper has put by since the last market, using the stall's existing "some" and "full" pictures. A keeper puts by one a dawn, so a stall holds at most about five by a later market. The "full" picture's threshold drops so that a stall stocked every day since the last market looks full; today it needs more than six. The keepers don't take more food from the larder. *(My call.)*
- The goods follow the year without any new rules: apples only in autumn, wool only in spring after shearing, few eggs in winter unless the hens get grain, and bread and honey all year. A stall with nothing to sell stands empty with its awning up. *(The user accepted this.)*
- Over the market day the stock goes. At dusk the traders take whatever's left, and every stall is empty. The keepers start putting by again at the next dawn. *(My call. The town design says the traders take the town's surplus.)* How the stock goes down during the day (all at once at dusk, or a little at a time) is left to the builder.
- The keepers already leave a reserve in the larder and the wool basket for the survivor. That doesn't change.

### The square on market day

*(The user accepted this.)*

- **The stallholders** stand at their stalls all day.
- **The other townsfolk** leave their usual work spots and mill about the square. Their work still gets done that day: workers never fail, and their output is unchanged. At dusk they walk home as usual.
- **The traders.** One or two traders' carts come down the meadow's old road, past the milestone, over the bridge and into the square. They stand in the square through the day and leave the same way at dusk. Their carts show goods the hills can't make, such as glass, brass and spices, but those goods are just for show. Traders are strangers: they're not townsfolk, have no houses or jobs, and aren't saved as people.
- **The survivor** has nothing to do but wander and look.

### The first market and the lens

*(The user accepted this.)*

- On the first market day, one of the traders has something no one in the town could make: a glass lens.
- The first time the survivor comes near that trader on that day, the trader gives them the lens. It's a short, quiet moment with one line, and the survivor doesn't need to look for it. *(My call on how it's handed over.)*
- If the survivor never comes to the square that day, the trader leaves the lens with a stallholder, who hands it over the next time the survivor passes. The lens can't be missed for good. *(My call.)*
- The survivor keeps the lens. It has no use yet. Where it shows (a keepsake in the hall, a line in the journal, or both) is left to the builder, as long as it's somewhere the player can see it again later.
- **Journal lines**, which stay off the pages until they happen: the square opening, the first market day, and the lens. Later markets don't get journal lines.
- Later markets have no lens and no special moment. They're simply market day.

## Constraints

From the town design and the slices before this one:

- **EASTER EGG.** The town is a secret. Every new file and test starts with `// EASTER EGG: the town, see src/game/town.ts.`. Nothing goes in the README or player-facing help.
- **Copy** is plain and warm, not poetic, with no exclamation marks.
- **No new dependencies and no image files.** Sprites (the sign's two faces, the traders' carts and the traders) are drawn in code with `define(...)` like the others.
- **Saves** need the next `SAVE_VERSION` with an upgrade step, and it must be the only open PR doing so. Validation rejects impossible states, such as a lens before any market, or a market before the square opens. Older saves that already meet the conditions open the square on their next dawn, and their first market follows the usual rule.
- **Logic in tested helpers.** SonarCloud needs 80% on new code, and `App.ts` and the scene classes are untested.
- **Everything works by tap as well as by key, and while the survivor is weak.**
- **The scripted playthrough** should reach the first market day and the lens, if that stays fast. Run it on Node 24 and Node 26.
- **Checks:** `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`, and a browser check at desktop and phone sizes of the sign's two faces, a market day in at least two seasons, the traders arriving and leaving, and the lens being handed over.

## Left to the builder

- How the stock goes down through the market day.
- Where the traders' carts stand in the square and how they move along the road and bridge.
- How the townsfolk spread out around the square.
- The new threshold for the "full" stall picture.
- The exact wording of the sign, the greetings, the lens line and the journal lines, within the copy rules.
- Where the lens is shown after the survivor has it.
- How the work is split into tasks.

# The Stone Keep Design

## Intent

Let the player raise one tall stone tower at the top of the hills path, a bit at a time, by carrying up stone from the quarry next door. It's mostly something to look at and be proud of. *(The user: "i think its more cosmetic".)*

Finishing it gives the one practical thing it has: a place to sleep on the hills, so a long trip doesn't have to end with the walk home. It also gives a view from the top. Nothing changes until the last stone is laid. *(The user: "maybe when its finished? otherwise Im not sure what the benefit of finishing it is".)*

This continues the camp's slow growth into a homestead and perhaps a castle, with no people in it. It also gives the forge and the loaded pony something more to do.

## Goals

- The player can see the tower rise. Even a small trip leaves it visibly taller. *(The user: "watch it rise a bit at a time".)*
- Coming up the path to a finished keep feels like coming back to something they built.
- The first night there feels earned.

## Non-goals

- A new home. The house at camp stays home for cooking, resting and stores. *(The user agreed they could commute; a second place to sleep is my suggestion, which they accepted.)*
- Extra storage. The game has plenty.
- Defence, sieges or wolves at the walls.
- Rooms to walk around in. Going in is a short fade. *(My call: the game has no indoor scenes.)*
- Changing how the house works. Its door could work this way later, but not in this project.
- Other people, trading, or anything to gather.

## Anti-goals

- **A chore.** The keep needs no fuel, no upkeep and no visits. A player can leave it half-built for a year and lose nothing.
- **A loss.** Laid stone stays laid. Sleeping away from camp costs nothing beyond what being out for a night would.
- **Danger.** It's as safe as the house, and it adds no new threats.
- **A required commute.** The player never has to sleep there.

## The player's path

1. With the forge built, the top of the hills path shows a place to build.
2. They carry stone up from the quarry and lay it there, whatever they've brought. The footings appear, then the walls.
3. At head height the walls wait for a door. They make iron hinges at the forge and hang it, using wood from their stores.
4. They keep laying stone. Scaffolding goes up with the walls, and the tower gets tall.
5. The last stone goes on, the scaffolding comes down, and a line says the keep is finished.
6. From then on they can tap the door and go in: at night to sleep, by day to climb to the top.

## Where it stands and how it looks

- On the hills, at the top of the path. *(The user's choice.)* The exact spot is left to the builder. It must not cover the outcrop or a pony spot, the survivor must be able to walk around it, and the path should lead to its door, so the path may be extended or bent.
- One square stone tower, with battlements, an arched door and window slits, about 4 tiles wide and 6 tall. *(The user chose this from three sketches: sketch A, the plain tower.)* Drawn in code from the existing stone palette. The hall and walled-yard versions are out.
- Winter puts snow on the battlements and on the footings or unfinished wall tops.
- One window slit is lit at night once it's finished, so it looks lived in, whether or not the player is there.
- The survivor walks behind or in front of it correctly, as with other tall sprites.

## Building it

*(All numbers here are my call. The user approved the shape of the idea: no saving up, four visible stages, about 60 stone, and no deadline.)*

- **The site appears** once the forge stands. Before that it's a bare patch of ground with nothing to tap or say.
- **Lay stone:** standing at the site, or by tapping it, the player lays one stone from the bag per go. The stone must be in the bag; the camp's stone pile can't be reached from the hills. Each go takes half the time and energy of a dig at the quarry. A too-tired survivor gets the usual refusal.
- **No saving up:** every stone counts as soon as it's laid. The site keeps the total. It doesn't refund anything.
- **The tower shows the total.** It gets taller every four stones or so, so a trip with only a few stones still shows.

| Stage | Stone so far | What shows |
|---|---|---|
| Footings | 1–8 | A low square of stone in the grass |
| Ground floor | 9–24 | Walls to head height, with scaffolding and an empty doorway |
| Door | no stone | Laying stops at 24 until the door is hung |
| Upper walls | 25–48 | The tower grows tall, with window slits and more scaffolding |
| Top | 49–60 | Battlements. On the 60th stone the scaffolding comes down |

- **The door:** at 24 stones the prompt asks for it. It needs **iron hinges** and **4 wood**, and hanging it is one action at the site. The wood can come from the camp's stores as well as the bag, as the timber mine's wood does at the quarry, so it's not one more thing to carry. *(My call. Wood in the bag settles into the stores at camp and can't be taken back out, so carrying 4 wood up would be a fiddly puzzle.)*
- **Iron hinges:** a new item in the Workshop panel, once the forge stands: **2 ore, 1 wood**, made once. *(The forge's reason to matter here.)* They wait until the door is hung. Making them early is fine.
- **Any season:** building works in every season. In snow the pony waits at the foot of the path as it already does, so winter loads are smaller but nothing else changes.
- **How long:** with a pack, the shod pony and the iron pickaxe, a trip can carry 12 stone, and the quarry gives a few a day. So it should take about half a game year of steady trips. Nothing hurries it.
- **The finish:** the message says plainly that the keep is finished. There's a matching journal line and a morning note.

## The door

*(The user asked for this instead of standing by the door to sleep.)*

- Once the keep is finished, the door is a tap target. A tap walks the survivor there and they go in. E beside it does the same, and the prompt names what it will do.
- **At night:** going in means sleeping until morning. The survivor comes out of the door at dawn.
- **By day:** going in means climbing to the top for the view.
- Going in is a short fade, with the survivor gone from sight. Nothing else happens on screen while it plays, and it can't trap the player.
- Before the keep is finished, the door does nothing beyond the door step in **Building it**.

## Sleeping there

- The rules, rest and energy are the same as a good night in the house. There's a bed and a fire that lights itself, using no wood and needing nothing carried.
- It's as warm and safe as the house on a cold night or in a storm, whatever the camp's fires are doing. A player who sleeps there isn't sick or chilled by it.
- **Sick days:** a night in the keep counts as the warm rest a sick survivor needs. The warm meal still has to be eaten that day, so it isn't a cure. *(My call. Otherwise the keep could move a sick player closer to the end of the run, which breaks the "A loss" anti-goal.)*
- **Wolves:** nothing is taken from the bag while the survivor sleeps in the keep, even if the camp's fire is out on a winter night. The visit can still show at camp as tracks, and its message mustn't suggest a theft. *(My call. A wolf robbing someone asleep in a stone tower would make the keep look like a trap.)*
- Camp carries on as it does on any night the player is out. The camp fire and fireplace burn as they would with nobody home. Nothing there gets worse because the player chose the keep. *(Check what "out for the night" means in the current code; the player can't sleep away from home today, so if something at camp assumes they're there, it must not punish them for this.)*
- The bed is only for sleeping. The keep adds no cooking, resting spot or stores, and `isAtHome` stays about the house or campfire.
- **The shod pony** stays by the keep overnight instead of going home, so the player still has it and its bag spaces in the morning. In winter it's already waiting at the foot of the path, and that doesn't change. This only applies once the keep is finished.
- **Other friends** stay at camp and are back with the player on return. A friend's morning gift or wake-up doesn't reach the keep, and nothing is lost by missing a day. *(Check how the bird's alarm and gifts behave; the alarm mustn't fire or be spent while the player is on the hills.)*

## The top

- By day, going in takes the player up for the view: a short fade, a look at the hills and a line of text, then a fade back. *(The user approved "a view with no reward"; how it looks is left to the builder, as long as it stays short and works by tap.)*
- It gives nothing: no item, energy or bonus. The only record is the journal.
- It takes little time, about the same as stargazing.

## Journal and notes

- **Journal:** one line per season for looking out from the top, about what's showing. They stay off the pages until the keep is finished, so they never appear as blanks before that, using the same approach as the hills' lines. A line for finishing the keep goes on the page of the season it was finished in, and isn't a blank on the others.
- **Morning notes:** the morning after the first stone, a note that it's started. The morning after the hinges or door if it helps, and the morning after finishing.
- Copy is plain and warm, not poetic, and has no exclamation marks.
- The keep belongs in the README. It isn't an easter egg.

## Save format

This changes the saved shape, so it takes `SAVE_VERSION` **38** with an upgrade step, and it must be the only open PR doing so. Existing saves begin with no stones laid, no door and no hinges.

Validation should reject impossible states: stones laid below 0 or above 60; more than 24 stones without a door; a door without hinges; any stones or hinges without a forge.

## Constraints

- TypeScript, Phaser 3, Vite, Vitest and oxlint, with no new dependencies and no image files.
- Follow the existing patterns: `applyAction` handlers, `pickTapTarget`, `prompts.ts`, `newsBetween`, `JOURNAL_PAGES` and `JOURNAL_ICONS`, `WORKSHOP_UPGRADES` for the hinges, `src/ui/panels.ts`, and the derived `ponyWith` and `ponyPoseFor` for the pony.
- SonarCloud needs 80% coverage on new code and `App.ts` is untested, so keep logic in tested helpers.
- Everything is reachable by tap as well as by keyboard, and every path must still work when the survivor is weak.
- Lines from walking or crossing must reach the player, as `lineToSay` now ensures.
- Verify with `npm test`, `npm run lint` and `npm run build`, plus a browser check at desktop and phone sizes that plays the real path: carrying stone up, laying it by key and by tap, making the hinges by pressing the real button, hanging the door, laying the last stone, tapping the door by day and at night, waking on the hills, and saving and reloading at each stage.

## Left to the builder

- The keep's exact spot and the path's new end, as long as the rules in **Where it stands** hold.
- How many pictures the tower has between stages, as long as it gets visibly taller every few stones.
- How the scaffolding and the view from the top are drawn.
- Small numbers, as long as the whole keep stays about 60 stone and half a game year of steady trips.
- The exact wording of lines, within the copy rules.

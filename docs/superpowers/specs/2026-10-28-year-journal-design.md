# Year Journal: Design

Closes issue #54 (a goal after the lookout).

## Intent

The seasons give the year a rhythm, but after the lookout is restored the game has nothing left to point to. The year journal gives long sessions something to come back to, without becoming a to-do list.

It is a **keepsake of the camp's year**. The survivor writes down small moments as they happen: the first leaves falling, wolf tracks round the fire, rabbits in the rain, fireflies on a warm night. Leafing back through it should feel like reading a diary of the time you've spent at camp.

## Goals

- **A record, not a task list.** Entries are written in after something happens. The player finds out what can happen by playing (user's choice).
- **Show that more is out there without saying what.** Things not yet found appear as blank lines with a "?". The player can see how much of a season is left to find, but gets no clue what it is (user's choice, option A from the mockups).
- **Fresh pages each year.** Each year starts a new set of four season pages, so the journal grows into a record of every year at camp, and old years can be read back (user's choice).

## Non-goals

- **No game effect.** The journal is its own reward. There are no unlocks, decorations, bonuses or achievements (user's choice).
- **No new mechanics or wildlife.** Every entry comes from something the game already has.
- **No changes to the existing field journal.** Its map, milestones and next-step hint stay as they are.

## Anti-goals

- **A checklist.** No percentages, progress bars, "3/5 complete" counters, ticks or completion sounds. The blank lines are the only hint that more exists.
- **Missing out.** A season that ends with blank lines is simply a quieter page. Nothing is lost, there's no reminder or nag, and next year brings a fresh chance.
- **Spoilers.** A blank line never names or hints at its entry.
- **Busywork.** Entries come from things a player does or sees anyway, or chooses to try. Nothing should need grinding or exact timing.

## How it works

### Pages

- **One page per season per year.** The page is titled with the season and year, for example "Autumn, year one", with the days underneath ("Days 1–10").
- **Year number:** `floor((day − 1) / 40) + 1`. Day 41 starts year two.
- **Entries:** each written entry shows a small picture, the day it happened, and one line in the survivor's voice, for example "Day 4: A fox watched me from the berry bushes at dusk."
- **Blank lines:** each entry not yet found that season shows as a blank line with a "?" in place of the picture. Written entries come first, in the order they happened.
- **When a season ends,** its blank lines stay blank. In later seasons, past pages show their blank lines unchanged, which records a quiet season honestly.

### Where it lives

- **Placement:** a new panel in the sidebar's Camp tab, under the field journal. It opens on the current season's page.
- **Navigation:** simple previous and next controls leaf through the pages, back to autumn of year one and forward to the current season. Pages after the current season are never shown.
- **Availability:** the journal records from day 1 and is visible from the start (my call). A player who reaches the lookout already has pages filled in, and #54's gap is closed because the journal has no end.

### Writing an entry

- **The moment itself:** a quiet line in the message area: "Written in your journal: <entry line>" (my call). There's no sound, pop-up or flourish.
- **Once per year:** each entry is written at most once per season page, so once a year. The day recorded is the first time it happened that year.

### What can be written (my call; the builder may tune the copy and conditions)

There are five entries per season. Each season mixes ones most players will meet with a couple that take curiosity. All are derived from game state, so they can be tested.

| Season | Entry (survivor's line) | When |
|---|---|---|
| Autumn | "The first leaves came down over camp." | Any autumn day, awake at camp in daylight |
| Autumn | "A fox came by the bushes at dusk." | An autumn dusk at camp |
| Autumn | "The cold front came. I kept the fire through it." / "The cold front came, and the fire didn't last." | The night of a forecast cold front passes |
| Autumn | "Dried berries for the winter." | Prepare a trail ration in autumn |
| Autumn | "Lay back and counted stars." | Stargaze in autumn |
| Winter | "Snow fell in the night." | The first winter morning |
| Winter | "Paw prints round the fire this morning." | A wolf visit this winter |
| Winter | "The quiet spring had frozen over." | Visit the spring in winter |
| Winter | "Kept the fire alive through a whole winter night." | Dawn on a winter night at camp with the fire never out |
| Winter | "Cooked berries by the fire, with the snow coming down." | Cook in winter |
| Spring | "The first rain of spring." | Awake when a shower begins |
| Spring | "Rabbits in the meadow." | Daylight near the rabbits' homes in spring |
| Spring | "The bushes are full again." | Pick a berry in spring |
| Spring | "A stump I cut is growing back already." | A tree you chopped regrows in spring |
| Spring | "Sat a while at the spring, now that it's thawed." | Rest at the quiet spring in spring |
| Summer | "Fireflies over camp." | Awake at camp on a summer night |
| Summer | "Two handfuls from one bush." | Pick berries in summer |
| Summer | "The evening went gold." | Awake at camp through a summer dusk |
| Summer | "Slept out without a fire, and it was warm." | Sleep through a summer night with the fire out |
| Summer | "Watched the land from the lookout on a long evening." | Stand at the restored lookout on a summer evening |

Where a condition depends on something only the scene knows (where the rabbits sit, when the fox appears), the builder should pick a state-based condition with the same feel. For example, "near the rabbits' homes" means within a few tiles of where the rabbits live, rather than needing a rabbit on screen.

### Save

- **Save version 14.** It adds the journal: for each year, which entries were written and on which day. Years with nothing written need no data.
- **Older saves are rejected**, as with every save change so far. Follow the README rule: only one open PR may change the save format.
- **Long games:** the journal must stay small however long a game runs. Twenty entries a year at most, stored as entry ids and days.

### Detection rules (my calls, settled after the builder check)

- **What the check can see.** It sees the state before and after, plus the action that caused the change (or none, for a frame tick). Cook, prepare, stargaze, pick, rest and chop leave no trace in state, so the check needs the action. It must not need new state flags beyond the journal itself.
- **Shared definitions:**
  - "At camp" means `isAtCamp`.
  - "Night" means `timeOfDay ≥ nightStart(day)`.
  - "Dusk" means the window before nightfall that lighting already uses: 30 s, or 45 s in summer.
  - "Awake" means any time passing other than a `sleep` action. Time spent in other timed actions counts.
  - Only the sleep entry ("Slept out without a fire…") comes from a sleep. Other entries whose moment falls during a sleep are not written.
- **Which page an entry lands on.** It goes on the page for the day the moment belongs to.
  - A night that ends at dawn belongs to the night's day (`before.day`). This covers the cold front, the winter night by the fire and the summer sleep.
  - The first winter morning belongs to the new day.
  - Each season has its own five entries, and an entry is only written in its own season. A cold front that slips into winter after failed tries writes nothing on the winter page.
- **Fox and fireflies.** These exist only in the scene, so their entries are based on time: an autumn dusk at camp, and a summer night awake at camp. The fox line becomes "A fox came by the bushes at dusk." so it doesn't claim a sighting the player may have missed.
- **Rabbits:** "near their homes" means within 4 tiles of a rabbit home, in spring daylight. The rabbit homes become shared data that the rules layer can read.
- **Cold front:** a single entry id, `coldFront`, whose line depends on whether the front was weathered. It is written at the dawn that ends the front's night, including when the player sleeps through it.
- **Wolf tracks:** written when `lastWolf` changes to a winter day.
- **Messages:** journal lines follow any news lines (rain, heat, wolf, season) after the action's own message, through the same message mechanism as `newsBetween`.
- **Save version:** no other open PR changes the save format (checked 2026-10-28), so this one can take version 14.

## Constraints

- **Code layout:** the rules and data live in pure, tested modules. `GameScene` and `App` get thin calls only, as with the seasons.
- **Detection:** entries are detected from game-state changes between ticks and actions, in the same way as `newsBetween`. A timed action or a night's sleep that crosses a moment must still write it.
- **Layout:** works at desktop size and on a phone held upright (390×844), in the Camp tab.
- **README:** gets a short section on the journal. It describes the journal without listing the entries, so it doesn't spoil them.

## Left to the builder

- The pictures for entries: small pixel icons in the existing style, or reuse of existing sprite frames.
- The exact wording of each line, and fine-tuning of the "When" conditions, provided they stay gentle and derived from state.
- How the previous and next controls look.
- How many entries per season, if five turns out too many or too few in play. Keep every season the same size.

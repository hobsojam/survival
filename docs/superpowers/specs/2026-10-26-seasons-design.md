# Seasons — design

## Why

After the lookout is repaired, Hearthwild runs out of direction (issue #54). Seasons give longer sessions a shape. The world changes how it looks and what it asks of you, so longer play is rewarded and the camp you build has to hold up through the year. Seasons should feel like seasons, not weather: long enough to settle into, plan for and come out of.

## Goals

- A repeating year of four seasons. Each one changes the look of the world, its wildlife, and at least one rule that matters.
- Winter is the year's real test. Autumn is for preparing, spring is recovery, summer is plenty and stocking up.
- Everything stays gentle, as now: nothing ends the game, and every season is recoverable.

## Non-goals

- No end-of-year scene or year-based difficulty. The seasons just keep turning, the same each year (user's choice).
- No new areas, structures or tools in this project. Seasons work through the existing camp, fire, food and wildlife.
- No migration of older saves. Like every save change so far, older versions are rejected.

## Anti-goals

- Seasons that feel like weather: a change every couple of days, with nothing to plan for.
- A winter you can only survive by knowing the numbers in advance. A first-time player who keeps the fire going and eats when hungry must get through it.
- Wolves that feel like a fail state. They are a nudge to keep the fire lit, not a punishment.

## Decided

### By the user
- **Length:** 10 days per season, so a year is 40 days (about 30–40 minutes of play per season).
- **Wildlife:** rabbits in spring and wolves in winter.
- **Wolves are a gentle threat:** they steal a ration.
- **The year repeats unchanged**, with no ending.
- **Summer is the season when no fire is needed.**
- **Day length changes over the year** and is part of the first PR.

### My calls (open to change)
- **The calendar starts in autumn on day 1:**

  | Season | Days |
  |---|---|
  | Autumn | 1–10 |
  | Winter | 11–20 |
  | Spring | 21–30 |
  | Summer | 31–40 |

  Then autumn again from day 41. The season comes from `day` alone: `(day − 1) / 10`, rounded down, taken mod 4. The existing autumn cold front on day 3 stays as the first warning of winter.
- **The day number keeps counting up across years** (day 41, day 42, and so on), because messages and prompts already name days, such as "regrows day 9".
- **Winter food:** berry bushes are bare all winter, as in the outline you saw. Any slower regrowth turns out too generous: even one berry per bush every 3 days is about 2.7 berries a day, around 67 hunger raw, against about 30 lost a day. Bare bushes make autumn and summer stocking count: a winter needs about 300 hunger, roughly 7 trail rations (45 each), and berries picked in late autumn still keep in the bag or crate. A player who arrives with nothing goes hungry but never dies, and spring brings the bushes back.

## The seasons

### Autumn (days 1–10, then 41–50, …)
- **Look:** broadleaf trees turn orange and gold, grass turns golden-green, and leaves drift down now and then. Pines stay green.
- **Wildlife:** fox and birds, as today. No fireflies.
- **Rules:** today's game, unchanged. The cold front and its retries work as now. This is where a new player learns the basics, repairs the lookout, and starts drying rations.

### Winter (days 11–20, …)
- **Look:**
  - Snow covers the ground and paths, and the camp circle is a trodden darker patch.
  - Snow sits on the pine tops, and broadleaf trees are bare.
  - The quiet spring (the rest site) shows as ice.
  - The survivor's breath shows on cold nights. This is optional; the builder can drop it if it's costly.
- **Every night is a cold night.** Warmth loss and fire burn follow the existing cold-front rules: outside or unsheltered loss, and double burn. But there's no forecast card and no failure penalty. The autumn cold front's penalty (wake tired, lose the morning) stays tied to the forecast cold front only.
- **Bare bushes:** berry bushes give nothing all winter. Branches, fiber and trees regrow as usual.
- **The quiet spring doesn't restore energy** while frozen: "The spring is frozen over."
- **No birds.** The fox still visits.
- **Wolves:**
  - **Warning:** on a winter night, when the fire is out or below 20 seconds of fuel, 1–3 pairs of wolf eyes show at the camp edge, and a howl plays now and then. The eyes keep back from the survivor like the quarry eyes do, and they fade when the fire is fed.
  - **Theft:** the first time on a winter night that the camp fire is out, a wolf takes one trail ration from the bag. If there are no rations, it takes one berry. If there's neither, it only leaves tracks. At most once per night, wherever the survivor is.
  - **Message:** "A wolf slipped into the dark camp and took a ration." If the survivor is asleep, the message is shown on waking instead.
  - **Tracks:** paw prints circle the fire pit from that moment until the next nightfall.
- **Overnight message** on the first winter morning: "Snow fell in the night. Winter has come."

### Spring (days 21–30, …)
- **Look:** fresh bright greens, flowers scattered across the meadow, and puddles on rainy days.
- **Wildlife:**
  - **Rabbits:** 2–3 near the meadow and bushes, hopping and nibbling. They flee from the survivor like birds do.
  - Birds return. The fox visits.
- **Rain showers:**
  - On some spring days (chosen deterministically from the day number, roughly 1 day in 3), it rains for part of the day.
  - While it rains, being away from camp, or at camp without the shelter, costs warmth as on an ordinary night, and the fire burns 1.5× faster.
  - The game shows rain falling, and a message when it starts: "Rain is coming in."
- **Faster growth:** trees regrow in 2 days instead of 3.

### Summer (days 31–40, …)
- **Look:** lush deep greens, a golden evening tint, and fireflies at night (fireflies become summer only).
- **Warm nights:** at night, warmth doesn't fall anywhere. There's no warmth loss outdoors, and the fire is optional. A fire still cooks.
- **Heat:** in the middle of the day (`timeOfDay` 60–130), hunger falls 1.25× faster.
- **Plenty:** berry bushes give 2 berries when gathered.
- **Wildlife:** birds, fox and fireflies.

## Day length over the year

- **The day stays 4 real minutes (240s); only where night begins moves.** Night length follows a smooth curve over the 40-day year, a little each day, with no jumps at season changes:

  | When | Night starts | Daylight | Night |
  |---|---|---|---|
  | Midwinter (day 16) | 130s | ~2:10 | ~1:50 |
  | Mid-autumn and mid-spring (days 6, 26) | 160s, as today | 2:40 | 1:20 |
  | Midsummer (day 36) | 190s | ~3:10 | ~0:50 |

  My call: a cosine, so `nightStart(day) = 160 + 30 × cos(2π × (day − 36) / 40)`, rounded to whole seconds. Day 1 gives about 181s, so the first days run a little longer than today's.
- **`nightStart(day)` replaces the fixed `BALANCE.nightStart` everywhere it's read:** the clock, lighting (dusk and dawn shift with it), forecast, sound, prompts, panels, ambient life, and the rules for cold nights, sleep and fire. Dusk keeps its current length relative to night start.
- **No save change:** night start comes from `day`.
- **Balance:** a 1:50 winter night at double burn uses about 3 logs, not 2. The winter forecast text and the README should say so, and branches still regrow daily in winter.
- **Sleep still skips the night,** whatever its length.

## Showing the season

- **Day pill:** shows the season, for example "Winter · Day 14 · Morning". On narrow phones, where space is short, the time-of-day word drops out and the dial shows the time.
- **Journal:** a small year wheel shows the four seasons, where you are now, and how many days are left in the season.
- **Season change:** a message on the first morning of each season. The terrain and trees redraw as the scene changes.
- **Forecast card:** in winter it says "Winter nights are bitter. Keep the fire alive until dawn, or the wolves will come close." In other seasons it keeps its current role while the autumn cold front is pending.

## Save

- **Save version 13.** It adds only what can't be worked out from `day`: the day of the last wolf visit, used for the tracks and the once-a-night limit. Season and rain are derived from `day`.
- **Older saves are rejected**, as with every save change so far. Follow the README rule: only one open PR may change the save format.

## How it gets built: one PR per step, each playable on its own

1. **Calendar and looks.** `season(day)`, `nightStart(day)` with the changing day length, the day pill, the journal wheel, the season-change messages, recoloured terrain and trees per season, and seasonal fireflies. The only rule change is the length of the night.
2. **Winter.** Cold nights, frozen berries, the frozen spring, no birds, wolves (eyes, howl, theft, tracks), and the winter forecast text. Includes save version 13.
3. **Spring.** Rain, rabbits, flowers, and faster tree regrowth.
4. **Summer.** Warm nights, midday heat, double berries.
5. **README** updated in each PR as it lands.

## Left to the builder

- **How seasonal art is produced:** palette swaps per season, registered as extra textures, versus new sprite frames. Snow probably needs some new frames: snowy pine tops and a bare broadleaf.
- **Rain and falling-leaf effects:** reuse the `SceneEffects` particle approach.
- **Wolf and rabbit sprites**, in the existing wildlife style.
- **Tuning:** exact values (day-length swing, wolf fuel threshold, rain frequency, heat window) can move during play-testing, as long as the anti-goals hold.

## Risks to check during review

- **A first-time winter:** a player who arrives at winter with no rations and only the shelter must still get through. Starving drains energy but never kills, the fire is the key, and branches still regrow. If play-testing shows this is miserable rather than tense, the fallback is one bush by camp that keeps a berry every few days.
- **Sleep and the wolf:** sleeping through a night advances time in one jump. The wolf check must still notice that the fire went out during that jump, and it must apply the theft only once.
- **The autumn cold front running into winter:** if it's still pending (retries every 3 days) when winter starts, the two kinds of cold night must not double up their effects.
- **Night start moving under the player:** the change from one day to the next must not flip day to night mid-action. The value only changes at dawn, when the day number changes.
- **Long saves:** saves past day 40 have to load, show the right season, and keep counting.

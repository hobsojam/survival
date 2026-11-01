# A Hungry Winter: Sickness, Ice Fishing and an Ending

Agreed with the user in chat on 2026-10-31. Where something below is marked **(my call)**, it's Claude's decision, not the user's. The user may override it.

## Why

A player who didn't lay food by for winter, or didn't know they had to, gets stuck:
- **No food anywhere.** Winter has no berries. Pine needles are only for tea, and tea doesn't fill you. The garden and the beds are dormant.
- **Nothing to do.** All the player can do is gather wood and fiber.
- **No reason to act.** Hunger at zero never does lasting harm. The player can leave the game running for days in real time and simply wait for spring.

The game is cosy, but right now it has no threat at all. The user wants hunger to be able to go wrong in a way that's **recoverable, but only if recovery is attempted**. Sitting and waiting must stop being a safe choice.

## Goals

1. **Starving makes you sick, and sickness can kill.** Death ends the run.
2. **Winter has a hard-won food source**, ice fishing at the Quiet spring. Being hungry, sick or exhausted never blocks it.
3. **Sickness takes care to cure:** warm food and warm rest over a couple of days. Eating alone isn't enough.
4. **The game warns you that winter is coming**, in places players actually see.
5. **You can see how the survivor feels.** Cold, hungry, tired and sick are clear on the survivor at a glance, even while walking.
6. **Death has a gentle ending,** with the journal to download.

## Non-goals

- **Snares.** They're wanted later, as a separate piece of work.
- **Ways to survive death,** like roguelike carry-over or a second life. The user said: "its not a roguelike. death is the end."
- **Rebalancing the other seasons.**
- **New areas.** Fishing happens at the existing Quiet spring.
- **The journal panel.** It stays as it is. The user thinks it gets missed, so it isn't used for warnings.

## Anti-goals

These would make the feature a failure even if it technically works:
- **A rescue that can't be reached.** If any step of it is refused for being hungry, sick or exhausted, the soft lock is back.
- **Death by bad luck.** A survivor who keeps fishing must always get fed.
- **Waiting still pays off.** If a sick player who does nothing can last until spring, or recover anyway, the feature has failed.
- **Harsh or punishing tone.** No "Game over", and no scary art. It should stay warm and plain, like the rest of the game.

## The design

### Getting sick
- **The trigger:** the survivor falls sick once hunger has sat at zero for one full in-game day, 240 game seconds **(my call)**.
- **The message:** plain and warm, for example "You've gone too long without food, and you're falling ill."
- **What sickness does:** on top of hunger's existing effects, it **drains energy and warmth** over time.
- **Eating doesn't end it.** The survivor stays sick until cured.

### Getting better, or worse
- **What cures it** (the user's words): "warm food and/or tea. rest by the fire or in warm shelter (shelter with fire, house etc), over a couple of days."
- **How a day is counted (my call):** at each dawn, the day just ended is judged.
  - **A cared-for day** is one when the survivor ate warm food or drank tea, and also rested or slept somewhere warm.
  - **Warm food or tea** means anything cooked: toasted berries, roasted hazelnuts, honey cake, stew, salad, pine needle tea, and the new cooked fish. Raw food doesn't count.
  - **Somewhere warm** means resting or sleeping at camp with the fire burning (the shelter counts), or at home with the fireplace burning.
- **Recovery:** two cared-for days, not necessarily in a row, make the survivor well **(my call)**.
- **Getting worse:** each day that isn't cared for makes the sickness worse. At the dawn after the **third** uncared-for day, the survivor dies **(my call)**.
- **How the counts work (my call):** cared-for and uncared-for days are counted separately, and whichever total gets there first decides recovery or death. Only days that start with the survivor already sick are judged; the part-day when sickness begins doesn't count. A warm rest needs the fire actually burning: the shelter on its own isn't enough ("shelter with fire"), and in the house the fireplace must have fuel.
- **Total time:** from running out of food to death is about four in-game days, roughly 22 real minutes. That's enough to walk to the spring, fish, cook and rest. It's also short enough that waiting for spring is fatal.
- **When it applies:** in any season. In practice it only bites in winter, because other seasons have food.

### Ice fishing at the Quiet spring
- **When:** in winter only, the spring's pool freezes and can be fished. The rest of the year it's unchanged.
- **Gear:** a **fishing line**, made at camp for 1 wood and 1 fiber, with no toolshed needed **(my call)**. It's offered in the Forest tools panel. Wood and fiber can always be gathered in winter.
- **Fishing:** stand at the frozen spring and press E, or tap. The survivor breaks the ice and waits. Each go takes a while, and longer when weak (tired, hungry or sick).
- **Failure** (the user said "fishing can fail sometimes"): about one go in three comes up empty, but never more than two in a row. The third try always catches. A failed go uses the time but costs nothing else. The game rules have no randomness today, so fishing needs a source of chance that tests can control, plus a saved count of misses in a row. That's what makes the two-miss cap testable **(my call)**.
- **Builds on the frozen spring:** the spring already has winter art and the message "The spring is frozen over." Fishing builds on both.
- **The catch:** a **fish**, a new food item.
  - **Raw**, it barely helps **(my call: about 10 hunger)**.
  - **Cooked at the fire**, it's a proper warm meal **(my call: about 45 hunger, like a trail ration)** that counts toward curing sickness.
  - It's cooked the same way berries are, at the campfire or the house fireplace, under the existing cooking rules **(my call)**.
  - Fish is fresh food and goes soft like berries **(my call)**.

### The rescue is never blocked
Every step from "out of food in winter" to "fed and getting better" must work whether the survivor is hungry, starving, sick or exhausted. Weakness may slow a step down, but it never refuses it. The steps are:
- walking to the spring and back
- gathering wood and fiber
- making the fishing line
- fishing
- feeding the fire
- cooking the fish
- eating
- resting and sleeping

Today, heavy work is refused below 10 energy, but only crafting and building are refused that way. Gathering, feeding the fire, cooking, eating, resting and sleeping already work while exhausted. So the new fishing line and fishing are the steps that must be exempt, and the existing steps must stay that way. Tests must cover each step while exhausted and sick.

### The winter warning
The user chose two places:
- **The day pill** at the top of the screen. During the last three days of autumn it adds "Winter in 3 days" (then 2, then 1) with a small snowflake.
- **The forecast card** (Camp tab). In late autumn it shows a "Winter is coming" card in the same style as the cold-night forecast. The checks are:
  - **Food laid by:** "enough for 2 of 10 days". It counts kept food only, since fresh food won't last. A day's need is the hunger one day burns, 30 **(my call)**.
  - **A plain hint:** "The quiet spring freezes in winter. A fishing line could see you through." **(my call)**

  If a cold night is also forecast, the builder decides how the two share the card, but neither may hide the other.
- **The existing late-autumn message stays.** It's the one at dawn on autumn day 8 saying the bushes are thinning.

### How the survivor looks
The user chose **bigger body language, always on**, option A in the mockups.
- **Show while walking:** the poses stay visible while the survivor walks, not only while standing still.
- **Stronger poses:**
  - **cold:** a real shiver with breath puffs
  - **hungry:** a hunched walk
  - **tired:** a drooping head
  - **sick** (new): a slow sway, a pale face and a little cough puff
- **When several apply,** the most serious state leads: sick, then cold, then tired, then hungry **(my call)**. The builder may layer small cues, such as breath puffs whenever cold.
- **Sound:** if the soundscape has a fitting cue, sickness may get a soft cough **(builder's choice)**.

### The ending
- **The moment:** the survivor lies down where they are and the screen slowly fades.
- **The card:** a quiet card reads, for example, "Your survivor's story ended on the 6th day of winter, in their first year." Under it is a short line of what they made: days lived, buildings raised, and a friend if they made one.
- **Two buttons:**
  - **Download your journal:** a plain-text file of the journal entries as the game shows them **(my call: plain text)**.
  - **Begin again:** starts a new game.
- **The save is cleared.** Reloading can't bring the survivor back.
- **Wording:** gentle. Never "Game over".

## Constraints

- **Save format:** this adds new saved state (sickness, the fishing line, fish, fishing's bad-luck counter). `SAVE_VERSION` goes up by one, with an upgrade step in `src/game/saveUpgrades.ts`, and `tests/fixtures/save-v23.json` must keep loading. An upgraded save starts with no sickness.
- **Tests:** everything new has tests in the existing Vitest suite, including the anti-goals above.
- **CI coverage:** the SonarCloud gate needs 80% coverage on new code. Keep DOM logic out of `src/ui/App.ts`, in tested helpers (see `src/ui/showPanels.ts`).
- **Copy:** plain and warm, with no exclamation marks, matching the existing messages.
- **Mobile:** everything must also work on the phone layout.

## Left to the builder

- **Exact numbers,** within the shapes above: drain rates while sick, fishing duration, and the raw and cooked fish values.
- **Pixel art** for the poses, the frozen spring, the fishing line and the fish.
- **The fishing animation** and its prompt wording.
- **How the winter card and the cold-night card share space** when both apply.
- **The ending card's layout.**

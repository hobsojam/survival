# Animal Names Design

## Intent

Let the player name the animals that share their camp, then have the game use those names. The fox becomes Rusty, the first sheep becomes Maud, and a morning note says "Maud was in the feed again." It costs little to build and makes every animal already in the game more charming.

**This is about attachment, not rewards.** Names change nothing about how the game plays.

## Goals

- Naming comes at a natural moment: when a friendship forms, or whenever the player feels like clicking a sheep.
- A name pays off later, in morning notes and journal lines the player reads.
- Unnamed animals stay exactly as they are today, and nothing pushes the player to name them.

## Non-goals

- Renaming. A name is a small commitment. *(The builder's guess, confirmed by the user.)*
- Traits, moods, favourites or anything else that makes one sheep behave differently from another.
- New animals, or names for wild animals that aren't friends.
- Name tags or labels floating over animals on the map.

## Anti-goals

- **A chore or a nag.** No reminders, no journal blanks that shame an unnamed flock, no reward for naming.
- **A text-entry trap.** Typing a name must never walk the survivor or trigger a key command.
- **Noisy mornings.** Named lines stay occasional, so they feel like a small surprise.

## Who can be named, and how

| Animals | How the name is asked for |
|---|---|
| Bird, fox, wolf | A prompt appears at the moment the animal stays. *(The user's decision.)* If it's dismissed, the friend can be clicked later to name it. |
| Three sheep | Each is clickable while unnamed, and clicking asks for its name. *(The user's decision.)* |
| Three chickens | The same as sheep, once they're home at the coop. *(Confirmed by the user.)* |

- Each animal has its own name. Clicking an already-named animal does what clicking that spot does today.
- Friends made in an existing save get no prompt on loading. They're simply clickable until named.
- The prompt says what's being named, such as "The fox has stayed. What will you call it?", with a text box, a confirm button and a way to dismiss it.
- A dismissed prompt doesn't come back by itself.

## Seeing the names

A quiet list in the panels shows who's been named, so a forgotten name can always be looked up. *(The user's decision.)*

- The Sheep panel says something like "Maud and Bess live here", and the coop panel and the friends' panel do the same.
- It lists only animals with names. With none named it shows nothing, and it never mentions how many are left, so an unnamed flock sees no gap or reminder.
- Which sheep is which doesn't matter. All three stay identical and keep moving between spots in the pen, and names are stored by position in the flock.

## Rules for a name

- Trimmed, 1 to 12 characters, and not blank. Two animals may share a name.
- A name is player text, so it must be escaped wherever it's shown. Panels here build markup as strings, so this needs real care.
- Save validation accepts only a string of that length or null for each animal.

## Where names appear

**Existing lines** that mean a specific friend use its name once it has one. For example, "The fox left a berry by your bedroll." becomes "Rusty left a berry by your bedroll." Lines about wild animals keep their wording, so "A wolf slipped into the dark camp and took a ration." stays as it is. The same applies to the secret rabbit note: it uses the wolf's name but stays out of the README, under the easter egg rule in `AGENTS.md`.

**New morning notes** for each kind of named animal, such as:

- "Maud was in the feed again."
- "Maud has stopped pretending not to know you."
- "Rusty watched you work for a while, then pretended not to."

At most one a dawn, and about one dawn in ten once something is named. They only appear for animals that are named and present. The notes can follow the `findDue` pattern in `src/game/companion.ts`.

**Journal:**

- **Named lines:** a few new lines across the seasons that use a name. They stay off the page, leaving no blank, until something is named.
- **Shearing:** gains named variants when a sheep has a name: "Sheared Maud and the others. They looked smaller and rather cross." and "Sheared the cloud. There was a Maud in there after all."
- **Lines already written stay as written.** A line written before an animal was named never changes, and a line written with a name keeps it. So the journal entry must store the name it used, because today entries store only an id and a variant.

**Other text that means a specific friend** uses its name too, such as "Your bird's feathers" in the panels and "a friend in the fox" in the ending text. *(The builder's call.)*

Copy is plain, warm and short, with no exclamation marks. The examples here are a starting point, and final wording is left to the builder within that style.

## Save format

This changes the saved shape, so it takes `SAVE_VERSION` 35 with an upgrade step, and it must be the only open PR doing so. Existing saves start with every animal unnamed.

## Constraints

- TypeScript, Phaser 3, Vite, Vitest and oxlint, with no new dependencies. Follow the existing patterns: `applyAction` handlers, `newsBetween`, `JOURNAL_PAGES` and `RULES`, and `pickTapTarget` in `src/scene/tapTarget.ts`.
- The naming dialog pauses the game while it's open, like the existing pause dialog, and keys typed into it don't reach the game.
- It must work on a phone: tapping an animal works, and the on-screen keyboard doesn't hide the text box.
- SonarCloud needs 80% coverage on new code and `App.ts` is untested, so keep the logic in tested helpers.
- Verify with `npm test`, `npm run lint` and `npm run build`, plus a browser check at desktop and phone sizes, including a name with markup characters such as `<b>`.

## Tapping animals

*(These are the builder's calls, following the "no nag" anti-goal.)*

- A stray naming box is not acceptable. A player who never names the hens must not get the dialog on egg runs, and tap-to-walk must not land on a friend trailing the survivor.
- So a tap asks for a name only if it lands on an unnamed animal's sprite, and any other tap target at that spot wins. This is a separate, tighter check than the 1-tile radius in `pickTapTarget`. Existing tap behaviour doesn't change for players who don't tap an animal directly. Tune it in the browser check, including whether hens can still be tapped beside the coop.
- The only cue is a pointer cursor over an unnamed animal, plus a line in the README. Phones have no hover, so a phone player finds this by tapping a sheep or reading the README.

## Left to the builder

- The exact wording of notes and journal lines, and how many there are.
- Whether a click on an unnamed animal also walks the survivor there. The likely answer is no, since the pen can be far away.
- The pronoun in the prompt and in lines: prefer wording that doesn't need one.

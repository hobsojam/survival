# The view from the keep

## Intent

Make climbing the finished keep feel like a reward for building it. By day, going up opens a painted picture looking out from the battlements over the player's own land, with their camp small in the distance, and it stays until they choose to come down.

A top-down game already looks down from above, so height alone gives the player nothing new. What they've never seen is everything at once, because the game shows one area at a time. The feeling to aim for is "it's all one place, and I made that". The little windmill matters because the player built it.

The user saw a rough mockup with the seasons and camp stages and said: "yes, I like it". It's in `docs/art-review/keep-view/mockup.html`. Its composition and mood are the reference. Its art is placeholder.

## What's there today

`climbKeep` passes 12 game seconds and says "You climb to the top and look out over the hills for a while." The scene plays a 2.6-second fade (`src/scene/doorFade.ts`), during which the camera pulls back over the hills, then returns by itself. The first climb of a season writes a journal line. This project replaces the pull-back. The rest of the climb's rules stay.

## Goals

- The player recognises their own camp in the picture, and it reflects what they've built.
- The picture is worth looking at for a while, so it has gentle movement and no time limit.
- It looks different in each season, which gives a small reason to climb again.
- It works by tap and by keyboard, on desktop and on a phone in either orientation.

## Non-goals

- A map. It has no labels, markers, buttons or tappable places, and it doesn't help with navigation.
- A reward. It gives no item, energy or bonus, as the keep's design already says. *(The user approved "a view with no reward" for the keep.)*
- True geography. The areas are separate scenes and don't line up, so the picture only has to feel right.
- A view at night. Night at the door still means sleep.
- Changes to the keep's cost, building, sleeping or pony rules.

## Anti-goals

- **A chore or a cost for lingering.** Looking for a long time must cost nothing.
- **A trap.** The player must always be able to come down, and a reload must start clean.
- **A menu.** If it reads as a screen of information rather than a view, it has failed.
- **A false picture.** It must never show a building the player hasn't built.

## The player's experience

1. By day at the finished keep's door, the player taps it or presses E, as now.
2. The screen fades to black, then opens on the picture. The survivor isn't drawn; the player is looking through their eyes.
3. The season's line sits over the bottom of the picture. Nothing else is written on it.
4. The player looks for as long as they like.
5. A tap or a key press starts the fade back, and the survivor is at the door again.

## The picture

From back to front, as in the mockup:

- Sky with drifting clouds.
- Distant hills.
- Woods, in rows that get bigger as they come nearer, coloured by season.
- The camp, in its clearing among the woods, about a third of the way across from the left and above the middle.
- The quarry's grey cliff, on the right.
- The worn path, winding from the foot of the keep towards the woods.
- The hills falling away: heather and bracken, in the season's colours.
- The keep's battlements along the bottom edge, as if the player is leaning on them.

### What the camp shows

The camp is read from the save, one landmark at a time, not from a set of fixed stages. These must each appear only if built, and must be recognisable at this small size:

| Landmark | Shown when | Notes |
|---|---|---|
| Clearing | always | Wider with each cleared side |
| Shelter | shelter built | Reads as the woodshed once the house stands |
| Campfire | no house yet | A small flame and smoke |
| House | house built | Roof, chimney, lit window, thin rising smoke |
| Vegetable beds | built | |
| Well | built | |
| Workshop | built | |
| Grain field | built | Strips coloured by season |
| Windmill | built | Sails turning |
| Bakery | built | |
| Sheep | they've arrived | Small white shapes that shift slowly |
| Orchard | orchard built | A tree for each one planted, growing with its age, with apples in autumn once grown |

The rest of the camp's smaller buildings are left to the builder: draw any that read well at this size and skip any that would only be noise.

### The seasons

| Season | Woods | Hills | Drifting across the picture | Line |
|---|---|---|---|---|
| Autumn | Orange and gold | Rusty bracken | A few falling leaves | From the top of the keep, the woods have all turned. |
| Winter | Bare, with pines still green | Snow | Snow, and snow on the roofs and battlements | Snow as far as I can see from the top of the keep. |
| Spring | Fresh green | Gorse in flower | A few petals | From the top of the keep, the gorse is out all the way down. |
| Summer | Deep green | Heather in flower | Nothing | Heather as far as I can see from the top of the keep. |

The lines are the journal's existing `keepView` lines. They show on every climb. Journal entries are still written as they are today.

## Rules

- **Time:** the climb still passes its 12 game seconds once. The clock waits while the picture is up, and hunger, warmth, energy and the fire wait with it, so lingering costs nothing.
- **Coming down:** a tap on the picture or a key press comes down. For the first second, input is ignored, so the tap or key that opened it can't close it straight away.
- **Esc** still pauses, and resuming returns to the picture. The clock is already held, and this keeps Esc meaning one thing.
- **Game actions:** while the picture is up, game actions such as eating or resting do nothing, whether from a key or a button, as they do during today's fade (`GameScene.perform` blocks them).
- **Page controls:** the sidebar and dock tabs, journal pages, Download journal, the sound toggle, Pause and New game keep working, with no new gating in `App.ts`. On a phone, if a sheet is open over the picture, the first tap closes the sheet as it does anywhere else, and the next tap comes down.
- **Messages:** the picture carries only the season's line. "You climb to the top and look out over the hills for a while." is dropped, because the picture now says it. The "Written in your journal: …" notice, and anything else the climb reports, is held until the player has come down, so it doesn't sit on the picture on a phone. Holding it mustn't lose it if the player reloads over the picture: the journal entry itself is written and saved at the climb as usual, and only the notice can be missed.
- **Overlays:** the game's own overlays that sit in the frame, such as the hint prompt, the phone's small meters and the frost effect, are hidden while the picture is up.
- **Reload:** nothing about the picture is saved. Reloading while it's up puts the player at the door.
- **Hidden tab:** the picture just stays up.
- **Save format:** no change. Everything comes from what's already saved. This project must not change `SAVE_VERSION`.

## Constraints

- TypeScript, Phaser 3, Vite, Vitest and oxlint, with no new dependencies and no image files. All art is drawn in code, in the game's pixel style.
- SonarCloud needs 80% coverage on new code and `App.ts` is untested, so keep logic in tested helpers. What the camp shows should be a pure function from `GameState` to a list of landmarks, tested for each row above, including that an unbuilt building doesn't appear.
- The picture must fill the game frame at every size the game supports, without black bars, and the camp must stay in view on a phone held upright. Check `src/scene/pixelScale.ts` for the sizes. The picture can crop at its sides but must not crop the camp.
- `tests/doorFadeScene.test.ts` covers today's fixed-length view. Update it for the new behaviour rather than removing what still applies: the climb happens once at black, input is ignored during the fades, and everything is put back afterwards, even on a very late frame. `viewZoom` goes if nothing else uses it.
- Don't add anything to the README beyond replacing the current description of the climb in **The keep**.
- Verify with `npm test -- --run`, `npm run lint` and `npm run build`, plus a browser check at desktop and phone sizes that plays the real path: tap the door by day, see the picture, wait, come down by tap and by key, pause and resume over it, reload over it, and compare a young and a full camp in all four seasons.

## Calls made without the user

These are my decisions, not things the user asked for.

- The climb line is dropped, and the journal notice waits until the player comes down.
- Page controls keep working over the picture, rather than being blocked.
- The clock waits while the picture is up.
- The first second ignores input, so the opening tap can't close it.
- Esc pauses rather than comes down.
- The house shows thin smoke by day here, even though the real fireplace is banked in daylight. The picture needs it, and it isn't a statement about the fire.
- The season's line shows on every climb, not only the first of a season.
- Rain isn't shown. A spring shower at the door doesn't change the picture.

## Left to the builder

- The exact composition and art, as long as it keeps the mockup's order and mood and the landmarks stay recognisable.
- How the picture is built in Phaser, such as a separate layer or scene, and how often its movement updates.
- Fade timings.
- Small extra touches, as long as they follow the anti-goals and add no new saved state.
- Any change to the sounds. None is required.

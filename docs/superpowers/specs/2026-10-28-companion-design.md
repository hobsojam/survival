# Camp Companion: Design

Closes issue #77.

## Intent

A companion has to be earned, not handed over (user's choice). Three wild animals already share the camp: the birds, the fox and the winter wolves. Any one of them can slowly become your friend if you win it over in a way that suits it. You can only ever have one friend; this is a cosy game, not a menagerie (user's rule). Once you have one, it stays for good, has its own small personality, helps in one gentle way, and now and then leaves a little fur or a feather by the fire, which you can make into one keepsake item.

## Goals

- **Three paths, one friend (user's choice).** The bird, the fox or a young wolf can each be befriended, each in its own way. The first one won over becomes your companion. The other two stay wild and visit as before (user's choice).
- **Discoverable, not explained.** Each animal shows what it eats before you're asked to feed it (user's question, my answer, which the user liked):
  - birds peck at the berry bushes, as they already do;
  - wolves take a ration, as they already do;
  - the fox gets a new nibble at the berry bushes at dusk.

  The offering prompt only appears when the moment is right.
- **Slow and gentle.** Winning a friend takes several days. Progress shows in how the animal behaves (it lingers, comes closer), never as a meter.
- **A friend with a personality**, which depends on the animal (user's choice):
  - the fox and the wolf nap by the fire;
  - the bird does not; it perches.
- **One small gift each** (user's choice: the wolf protects and the bird raises the alarm; the fox's gift is my call, see below).
- **Fur and feathers, kept small (user's choice).** The companion sheds now and then, and you can make one item from it: a pillow from feathers, or a cloak from fur.

## Non-goals

- **A menagerie.** Never more than one companion.
- **Farming.** Shedding is a slow trickle, not a resource to gather or trade. There are no extra recipes beyond the pillow and the cloak in this release.
- **Care or needs.** A friend never gets hungry, never leaves, never sulks and never needs looking after.
- **Changing your friend.** Once won, the companion is yours for the rest of the game. Starting a new game is the only way to choose differently (my call).
- **New journal entries.** The journal stays at five moments per season. Companion moments come as messages. Adding them to the journal is a possible later step.

## Anti-goals

- **A best choice.** Each gift should feel equally welcome, so a player who loves birds isn't punished for it.
- **A grind.** No path should need exact timing, long waits at one spot, or more than a few offerings.
- **A punishment.** Befriending never fails. An offering that comes to nothing (the animal wasn't there, or it was the wrong season) costs nothing but the berry.

## How it works

### Winning a friend

Each animal has a trust count that grows by one for each offering, at most once a day (once a night for the wolf). When it reaches the target, the animal stays. All values are my calls and can be tuned.

| | Bird | Fox | Wolf |
|---|---|---|---|
| **When** | Daytime, at camp, near a berry bush, any season except winter | At camp, while the fox sits at its seat on a day it visits (from `foxAt`) | Any winter night, at camp |
| **Prompt** | "Scatter a berry for the birds" | "Leave a berry for the fox" | "Leave a ration out for the wolves" |
| **Costs** | 1 berry | 1 berry | 1 trail ration |
| **Offerings needed** | 5 days | 4 visits | 3 nights |
| **Signs of trust** | One bird lands closer each time and stays after the others fly off | The fox sits a little nearer the fire and leaves later each time | One smaller pair of eyes stays at the edge after the others fade |
| **The moment it stays** | "A little bird has decided to stay." | "The fox curled up by the fire, and stayed." | "A young wolf stepped into the firelight, and lay down." |

- **The fox's nibble is new:** at dusk the fox pauses by a berry bush and noses at it before going on to its seat. The journal's fox line becomes "A fox nosed around the berry bushes at dusk." (Entry ids are unchanged, so saves stay valid.)
- **Prompts only appear when the offering is possible:** right moment, right place, the item in your bag, and no companion yet. Once you have a friend, no befriending prompts appear again.
- **The fox's visits** (`foxVisits`, `foxWindow`) are already worked out from the day. They move from the scene code into game code so the rules can read them.
- **Leaving a ration out for the wolves** is a deliberate choice. It's the same ration a wolf would otherwise steal, and on that night the wolf takes nothing more.

### Settled after the builder check (my calls)

- **How you make an offering.** Through the existing context prompt and the E key or a tap, the same way as gathering and exploring. The befriending prompt takes the prompt slot only when nothing nearer is offered. On a phone it's the same tappable prompt.
- **The wolf path doesn't need a low fire.** Asking players to let the fire burn down would fight "keep the fire lit", so the wolf offering works on any winter night at camp. The ration leaves the bag when you choose the prompt. That night a single smaller pair of eyes comes to the edge of the firelight, even with the fire lit, as the sign of trust.
- **Trust never fades.** Gaps between offerings are fine, and nothing is lost by waiting a season. All three counts can grow side by side, and the first animal to reach its target becomes the friend. The others' counts then stop mattering.
- **The bird's alarm.** On a winter night while you sleep, if the fire's fuel falls to 20 s (the moment the wolves would start to gather), the sleep stops there. It happens once per night, so going back to sleep afterwards isn't interrupted again.
- **The wolf's protection** is recorded as a new kind of wolf visit, "chased off", with its own message. It counts toward the once-a-night limit, and the tracks still appear.
- **The cloak and the pillow.**
  - **Cloak:** any warmth lost at night, at camp or in the quarry area, is multiplied by 0.75.
  - **Pillow:** sleep in the bed restores 10 more energy than `sleepEnergyGain`.
- **The fox's visit** is a time-of-day window (from about 20 s before nightfall to 50 s after), so it can be worked out from state. The rules read it once `foxVisits`, `foxWindow` and `foxAt` move into game code.
- **Save version:** no other open PR changes the save format (checked 2026-10-28).

### Living with your friend

**Bird:**
- perches on the shelter roof or the drying rack while you work;
- hops from tree to tree a little ahead when you walk;
- lands on the survivor's shoulder when you stand still for a while;
- tucks in under the shelter's eaves at night;
- stays through winter after the wild birds have left.

**Fox:**
- trots a few steps behind you, keeping its distance because it's still a fox;
- naps curled up by the fire in the evening and at night;
- pounces in the snow in winter;
- chases the spring rabbits without ever catching one.

**Wolf:**
- walks right beside you;
- lies stretched out by the fire at night;
- on winter nights, lifts its head and answers the wild wolves' howls.

All three stay at camp; none follows you to the quarry (my call, to keep the quarry quiet). They wait by the fire and come to meet you when you return.

### What each friend does for you

- **Wolf: it protects (user's choice).** On a winter night when the fire goes out, the wolf chases the wild wolves off, and nothing is taken: "Your wolf saw the others off into the dark." The visit still counts for that night's once-a-night limit, and paw prints still appear.
- **Bird: it raises the alarm (user's choice; my reading of it).** If you're asleep on a winter night and the fire is about to go out, the bird wakes you at that moment: "Your bird woke you. The fire is nearly out." You can feed the fire and sleep again. In spring it sings at dawn for pleasure, as a short birdsong on the sound layer.
- **Fox: it finds things (my call; the user wasn't sure).** Every few dawns (every third dawn) the fox brings a berry if your bag has room: "The fox left a berry by your bedroll." This also works in winter, when the bushes are bare. That makes it a gentle food help, about equal to the others' gifts.

### Fur and feathers

- **Shedding:** every third dawn, a tuft of fur (from the fox or the wolf) or a feather (from the bird) lies by the fire. Pick it up with E or a tap.
- **Storage:** it goes into a small "Keepsakes" count, not the bag, so it never competes for bag space (my call).
- **Making the item** at the toolshed, once each:
  - **Feather pillow:** 6 feathers, needs the bed. Sleeping in the bed restores 10 more energy. It shows on the bed.
  - **Fur cloak:** 6 fur. You lose a quarter less warmth on any night away from a lit fire, including cold-front and winter nights. The survivor wears it.
- With one companion, only one of the two items can ever be made in a game. That's expected.
- **Shedding continues after the item is made,** but it's capped at 12 stored, so nothing piles up.

### Save

- **Save version 15.** It adds:
  - each animal's trust count, plus the day of its last offering;
  - the companion (none, bird, fox or wolf) and the day it came;
  - the keepsake counts, and whether the pillow and cloak are made;
  - the day of the last shed, if it can't be worked out from the day the companion came.
- **Older saves are rejected,** as before. Only one open PR may change the save format.

## Constraints

- **Code layout:** the rules and data live in pure, tested modules. `GameScene` and `App` get thin calls only, as with the seasons and the journal.
- **State, not the scene:** all prompts, trust, gifts and shedding are worked out from game state, so they can be tested. The scene only draws.
- **Sleep:** the bird's alarm must split a sleep. A sleep that would run past the moment the fire is about to go out stops there instead.
- **Layout:** works at desktop size and on a phone held upright (390×844).
- **README:** gets a short section on companions. It hints at the paths without spelling out the exact offerings.

## Ideas for later (user's)

- Feathers decorating the shelter.
- Fur made into other clothes.
- Feathers to fletch arrows. This would bring in a bow and hunting, which is a new direction for a cosy game, so it needs its own decision first.
- Companion moments in the year journal.

## Left to the builder

- Sprites for the friendly bird (it can reuse the bird frames), the fox (reuse) and a young wolf. The wolf needs a new sprite in the existing wildlife style.
- The birdsong sound, generated like the other soundscape layers.
- Exact trust signs (how much nearer, how much later) and the exact copy, provided they stay gentle.
- Tuning the numbers in the table above, provided no path becomes a grind.

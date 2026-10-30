# Seasonal Foraging, Spoilage, and Camp Stores Design

## Intent

At present the only food is berries, and they keep forever in the bag. This design adds one new foraged thing for each season, a few simple dishes, and a gentle split between fresh food that goes soft and food that keeps. It also gives food and wood their own stores at camp, the way the stone pile works for stone, because you wouldn't store berries with timber.

The game is a cosy camp builder (see the README and the year journal), so these features should add charm and a seasonal rhythm without adding pressure. Preparing for winter should mean putting food by, drying rations and gathering nuts, not counting out survival rations.

## Goals

- Each season gets one new thing to find: hazelnuts in autumn, pine needles in winter, wild greens in spring and wild honey in summer.
- A cooking pot unlocks four dishes at the campfire.
- Fresh food (berries, greens) goes soft after a few dawns and simply disappears. Food that keeps (nuts, honey, needles, rations, roasted nuts) never spoils.
- Food stockpiles have a real limit: the bag, plus a larder at camp that holds 10.
- A woodpile at camp keeps wood out of the bag.
- Nuts and rations become the winter food. The fox accepts a hazelnut as an offering in winter.

## Non-goals

- Reworking the bag or the storage crate. That's covered by `2026-10-30-pack-fibre-stack-design.md`, which comes after this one.

## Order and dependencies

This project comes after **growing the clearing** (`2026-10-30-clearing-growth-design.md`). Plan and build it only once that's merged. The larder and woodpile go on their spots on the cleared ground, and "at camp" below means the zones that design defines.
- Fishing, hunting, farming beyond the existing garden, or new meters.
- Food quality grades, recipe timing, or exact ingredient amounts.
- Changing how the existing companion, wolf or garden rules work, beyond what is listed here.

## Anti-goals (a failure even if it technically works)

- **Rotten items in the bag.** Spoiled food never becomes an inventory item, a pile on the ground, or a chore to clear up.
- **Spoilage that feeds the animals.** Feeding the bird and fox is a real mechanic (trust from offerings). Spoiled food must not go to animals, add trust or count as an offering, and the message mustn't suggest it does.
- **Spoilage that feels like a penalty.** One plain line at dawn, merged into a single message however many items went. No warning sounds or red text.
- **A winter hunger trap the player never saw coming.** A player who stores nothing may go hungry in winter, and that's accepted (the user's call: hunger never ends the game, and resting at camp always works). They must be warned in plenty of time, though (see Winter warning). No winter fallback food, such as rosehips, for now.

## Constraints

- Every new item takes one bag space. Stone stays at two.
- Gathering uses the existing gather action (E, a tap, six seconds), with resource nodes that come back at dawn like branches and berries.
- New structures use the existing build flow: build inside the camp circle, 12 seconds, 6 energy. They're visible in camp and drawn in Phaser in the game's palette, with no image assets.
- New tools are crafted in the Forest tools panel and need the toolshed.
- Saved state changes, so `SAVE_VERSION` goes up. If save migrations exist by the time this lands, add one that turns each saved berry count into berries picked on the day of loading. Otherwise follow the current rule (old saves are rejected) and the README's "one open PR changes the save format at a time" rule.
- The year journal stays a keepsake. Nothing it records changes the game.

## Foraging

| Season | Find | Where | Amount and regrowth | Keeps? |
|---|---|---|---|---|
| Autumn | Hazelnuts | 3 spots under broadleaf trees near camp | 1 nut per gather, back each dawn through autumn. They're gone from winter's first dawn until next autumn. | Yes |
| Winter | Pine needles | 3 pines near camp | 1 bunch per gather, back each dawn through winter. Only in winter. | Yes |
| Spring | Wild greens | 3 patches near the quiet spring and in the meadow, plus 2 more that appear for the rest of any day with a shower | 1 per gather, back each dawn through spring | No (fresh) |
| Summer | Wild honey | 1 hollow tree, with bees drifting round it from the flowers | 1 honey per gather, back every third dawn through summer (about 3 a summer) | Yes |

Spots outside their season aren't shown and can't be gathered. Positions are left to the builder: they should be close enough to camp to reach easily, and they mustn't overlap existing nodes, paths or building sites.

Raw foods can be eaten from the bag like a berry (Eat button, or Q):

| Item | Raw hunger | Notes |
|---|---:|---|
| Berry | 25 (unchanged) | fresh |
| Wild greens | 15 | fresh |
| Hazelnut | 15 | keeps |
| Honey | 20, and 5 energy | keeps |
| Pine needles | can't be eaten raw | keeps; only used for tea |

**Q's order (my call):** Q eats the fresh food closest to going soft, then raw food that keeps, and never pine needles. Trail rations stay on T.

## Spoilage

- Each fresh item (berry, greens) remembers the day it was picked. That covers berries from bushes, the basket, the fox's dawn gift and the garden harvest.
- At dawn a fresh item is gone if it's at least **3 days old in the bag**, or at least **5 days old in the larder**. The limit depends on where the item is at that dawn. Moving it doesn't reset its age.
- All of a dawn's spoilage becomes one plain message, for example "Two berries had gone soft, so you threw them out." If you slept, it's reported with the other morning news.
- Fresh food is used oldest first wherever the game takes a berry: eating, cooking, drying a ration, planting the garden, offerings and the winter wolf. **At camp, oldest-first covers the bag and the larder together (my call)**, so the berry closest to going soft is used wherever it is. The bag-first rule applies only to food that keeps. The winter wolf still takes only from the bag.
- The Bag panel shows freshness for fresh items, such as "Berries 3 (1 going soft)". "Going soft" means it will be gone at the next dawn.
- Spoilage runs in every season, winter included. The cold doesn't preserve berries (the user's call).
- The README's winter advice changes from keeping berries to "dry rations and gather nuts before the snow comes."

## Winter warning

- From the last three days of autumn (days 8 to 10 of the season), the forecast card warns that the bushes will soon be bare. It suggests drying rations and gathering nuts, and says how much food that keeps you're holding (bag and larder).
- The first morning of those three days also gets one message line, for example "The bushes are thinning. Berries won't keep through the winter; dry some, and gather nuts."
- Outside those days the card stays as it is now: it shows only while a cold night is coming, or in winter.

## Cooking

**The cooking pot** costs 2 stone and 1 wood, is made in the Forest tools panel once the toolshed is built, and hangs on a tripod over the fire pit once made. Stone can come from the stone pile, as it can for other tools.

Without the pot, cooking stays exactly as it is now: one berry, after dark, at a lit fire. With the pot, the Cook action (C, and the After dark panel) offers a short list of what you can make with what you have. **Pot dishes follow the same rule as cooking now (my call): after dark, at camp, at a lit fire, eight seconds**, so cooking stays an evening ritual.

| Dish | Ingredients | Effect | Keeps? |
|---|---|---|---|
| Cooked berries (existing) | 1 berry | 35 hunger (50 with the drying rack), 10 warmth | eaten at once |
| Pine needle tea | 1 pine needles | 20 warmth, 5 energy | drunk at once |
| Greens and berry salad | 1 greens, 1 berry | 40 hunger, 10 energy | eaten at once |
| Roasted hazelnuts | 2 hazelnuts | makes 1 roasted hazelnuts for the bag; eating it gives 50 hunger | yes |
| Honey cake | 1 honey, 1 hazelnut, 1 berry | 60 hunger, and the next rest or sleep at camp restores 10 more energy | eaten at once |

**My calls:** roasted hazelnuts don't take honey, so there's one recipe for each dish. Roasted hazelnuts are eaten with Q, after fresh food. The honey cake's bonus lasts until the next rest or sleep, whenever that is.

The numbers are starting points for balance, set so that no dish beats rest and shelter as the main way to recover.

## Camp stores

### Larder
- A raised food cache on legs, built on its spot on the **north near step**, close to the shelter, once that ground is cleared. It costs 5 wood, 2 fiber and 2 stone.
- It holds **10 food items** of any kind: berries, greens, hazelnuts, honey, pine needles, rations and roasted hazelnuts.
- Store 1 and Take 1 for each kind, beside it in the build list, the same pattern as the stone pile.
- Anywhere in the clearing, eating, cooking, drying rations, planting and offerings can use food from the larder. You can't eat from it out in the forest or the quarry. Food in the bag is used first, the same rule as stone from the stone pile.
- **Wolves can't reach the larder.** The winter wolf takes only from the bag, as it does now (a ration first, then a berry). The new foods don't become things the wolf takes. Leaving a ration out for a wolf is the player's own choice, so **that offering can use a ration from the larder (my call)**. It still counts as that night's wolf visit.

### Woodpile
- Split logs under a little roof. It costs 3 wood and 1 fiber, with nothing needed first.
- It holds **12 wood**, with Store 1 and Take 1.
- Feeding the fire, Burn, builds and crafting can use wood from the woodpile, with bag wood used first. As with stone from the stone pile, wood used as a building material counts from anywhere (for example, for the lookout repair). The woodpile goes on its spot on the **east near step**. The cold-night forecast's log count includes wood in the woodpile.

## Companion

- The fox, outside winter: unchanged (a berry).
- **The fox, in winter: takes a hazelnut if you have one (bag or larder), otherwise a berry.** The offer prompt says which, for example "Leave a hazelnut for the fox."
- The bird and the wolf are unchanged. The fox's dawn gift is still a berry, picked that morning.

## Year journal

Add one entry to each season's page. Each is written the first time it happens in that season, once a year, like the others:

- Autumn: the first hazelnuts gathered.
- Winter: the first pine needle tea.
- Spring: the first greens and berry salad.
- Summer: the first wild honey.

Each gets a pixel icon in the journal's style. The builder can write the exact wording, in the tone of the existing entries.

## Art

New sprites in the existing pixel-art pipeline and palette, all added to the contact sheet (`sprites.html`):
- a hazel spot (nuts in leaf litter), a pine with needles ready to gather, a greens patch, and a hollow tree with bees, each with ready and gathered frames
- the larder (it can show how full it is), the woodpile (it can show how full it is), and the pot on its tripod over the fire
- bag and journal icons for each new item and dish

## Left to the builder

- Exact positions of the forage spots and structures, and the layout of the panels and buttons
- How inventory is represented in the code (for example, a list of picked days for fresh items), provided the rules above hold
- Copy wording, in the tone of the existing messages
- Balance changes to the numbers above, where playtesting shows they're needed, as long as the anti-goals still hold
- Tests: rules for each forage spot and season, spoilage at dawn in the bag and the larder, oldest-first use, the pot and each dish, the larder and woodpile limits and which stores are used first, the fox's winter nut, the wolf ignoring the larder, the journal entries, and the save shape
- Updating the README's play guide, controls table and test list

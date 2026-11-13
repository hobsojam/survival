# Bag and storage friction

## Intent

Make repeated trips to camp easier to manage. The bag limit should still shape what the survivor carries, while the player can see what occupies its spaces and put food away without many identical clicks.

## Goals

- Show a compact breakdown of occupied bag spaces, including stone and ore at two spaces each, beside the existing carried count.
- Keep food storage under player control. Wood, fiber, stone and ore continue to settle into their built stores automatically.
- Add a bulk action for each visible food row in the larder: **Store all** moves as many of that food as fit, and **Take all** moves as many as the bag can carry. The existing single-item actions remain.
- Preserve fresh food's picked day. A bulk store moves the oldest pieces first; a bulk take moves the freshest first, matching the current single-item actions.
- Show how many items a bulk action will move before the player presses it. Never discard or silently overfill food.

## Non-goals

- No larger bag or store capacities, new structures, automatic food storage, or change to food spoilage.
- No new save fields or migration.
- No change to resource spending from camp stores.

## Approaches considered

1. **Manual bulk transfer and space breakdown (chosen working assumption).** Removes repeated clicks while preserving the existing choice to keep food in the bag for travel. It adds a few controls to the larder panel.
2. **Automatic food storage in the clearing.** Would free spaces with less input, but could take travel food out of the bag unexpectedly and change how players prepare trips.
3. **Display only.** Would explain the full bag but leave the one-click-per-food transfer friction in place.

## Interface and rules

- The Bag panel shows one short line such as `Spaces: food 3 · wood 1 · stone 4` beneath `8/8`. Omit categories with zero spaces. The count includes food of every type, wood, fiber, stone and ore; `stone 4` means two stones occupy four spaces. The line is visible on desktop and phone. If the bag is empty, show `Bag empty`.
- Each larder row retains **Store 1** and **Take 1** and adds **Store all** and **Take all**. The bulk buttons include the number available to move, for example `Store 3` and `Take 2`, rather than a numberless label. Disable them when the count is zero, including outside the clearing.
- A bulk action moves only the amount that fits. It does not take extra game time or energy, matching the current single-item transfers. One action gives one message with the actual count moved.
- Storehouse capacity, the pony's changing bag capacity, and the current area all use existing capacity and access rules.
- Repeated bulk clicks after a store or bag fills refuse cleanly and change no state.

## Verification

- Rule tests cover partial transfers at both capacity limits; fresh food ordering; kept food; away-from-camp, missing-larder and zero-count cases; and unchanged save shape.
- UI view tests cover space math, empty and full bags, transfer counts, and disabled buttons.
- Check the panel at desktop and phone sizes, including a full bag and a nearly full larder.

## Left to implementation

- Exact wording and layout within the existing Bag and Camp stores panels.
- Whether the space breakdown is one line or wraps on a narrow phone.

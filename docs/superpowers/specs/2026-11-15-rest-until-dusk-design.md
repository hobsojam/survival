# Rest until dusk

Issue: #171. The player chose to design a one-click action after a browser assessment of a fresh opening and a targeted winter-to-spring stretch. In that stretch, about seven or eight Rest presses plus Sleep advanced each day. Food and fire still mattered, but repeated presses added little choice. The later save came from the scripted player, so this is a focused interaction finding rather than a claim about a full human playthrough.

## Intent

Let a player who is done for the day rest at home until nightfall with one action. Preserve the consequences and recovery of using the existing Rest action repeatedly. Make the likely food and fire costs visible before they start, and give them a chance to react to an important change during the rest.

## Goals and limits

- One activation replaces repeated Rest presses only for the remaining daylight of the current day. It ends when the game's Night phase begins and Sleep becomes available. The button can say **Rest until dusk**, with nearby copy explaining that it ends at nightfall.
- The action is available at the same home positions as Rest, once the shelter exists (or at a later house or hall home). Away from home, after nightfall, while paused, during sleep replay, and during a door transition, it cannot start. An attempted action gives a plain reason.
- Use the same time advancement as Rest: hunger, warmth, fire and fireplace fuel, rain, sickness, visitors, and calendar rules progress normally. Energy recovery and warm-rest sickness care match a sequence of short Rests: each full 20-second portion grants the normal recovery, a final shorter portion grants proportional recovery, and a honey-cake bonus can be consumed only once. There is no extra resource reward.
- Keep Sleep separate. This action never crosses dawn, starts a new day, or changes seasonal timing. It does not run alongside cooking, building, travel, or other actions, which already spend their time atomically.
- The player can still use ordinary Rest. No save format change and no new keyboard shortcut are required.

## Approaches

1. **Leave Rest and Sleep alone.** This preserves the current pace but keeps the seven or eight repeated presses observed on a quiet winter day.
2. **Add an awake wait until nightfall.** This is simple, but it drains energy where repeated Rest restores it; players would be penalized for using the convenience action.
3. **Bundle the existing Rest behavior until nightfall.** This removes the repeated presses while retaining their survival costs and recovery. The player chose this direction. The builder may choose the internal chunk size and helper layout, provided the observable result matches repeated Rest up to the stop point.

## Player flow

A compact card in the Camp tab's existing Camp Moments section shows the action and its preview on both desktop and phone. The preview sits beside the button, not in a hover tooltip or a confirmation dialog. It shows time remaining to nightfall and projected hunger and fire status, with a clear warning when hunger, warmth, or fuel may become low. If a time-limited visitor is already present, the preview says they may leave during the rest. The forecast is explicitly labeled as the outcome **if uninterrupted**. It uses the game time rules on a separate copy of state, never mutating the live game. Update it as time and supplies change; keep calculation cheap enough for the live HUD. The final wording may be adjusted for space, but it must fit a 390-pixel phone view without horizontal scrolling.

Pressing **Rest until dusk** starts immediately. The game advances through short Rest-sized portions, applies ordinary recovery, and checks after each portion for a reason to stop. It stops at the earliest of:

- Nightfall (normal completion).
- A new actionable or urgent event: rain beginning, a cold-night warning, hunger/warmth/fuel crossing the urgent threshold, sickness beginning or worsening, or a time-limited market trader, animal, or traveller arriving. Show the event or warning and leave the remaining time for the player to decide on another rest. A visitor already present at the start is warned about in the preview; choosing the action may let that visit end.
- Hunger or warmth entering the low/urgent band, or the fire keeping the current home warm going out. Show why it stopped; do not silently continue into a dangerous state.
- The story ending.

The player can press again after any interruption. Routine notices such as bakery production, food spoilage, journal writing, and companion flavor do not interrupt. Notices that occur within a portion are retained in order rather than replaced by the final “rested” message. A brief visual transition may convey elapsed time, but it must not add real-time waiting or conceal the resulting state.

## Constraints and verification

Use existing `advanceTime`, Rest recovery, `newsBetween`, and home/sleep rules where possible. Forecast and action must agree on the same endpoint in ordinary conditions. Tests should cover daytime/no-op/nightfall, home and shelter blockers, resource and energy equivalence to repeated Rest, winter/rain/fire depletion, sickness care, event and low-meter interruption, message preservation, and Sleep being available at the end. Check desktop and phone presentation in the browser. Keep the current full suite, lint, build, and PR coverage gate passing.

The builder may decide exact component structure, forecast wording, and a brief transition style. The player has not approved a change to sleep, season length, action costs, or automatic multi-day skipping.

## Builder-check decisions

The final partial portion uses proportional recovery, avoiding a full Rest reward for only one second. Only actionable or urgent events interrupt; routine notices are collected and shown at the end. These are design calls made after the builder check, not new player requirements.

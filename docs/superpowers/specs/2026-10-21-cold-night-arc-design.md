# Cold Night Arc Design

## Outcome

Give the first three days a clear, recoverable goal. A forecast cold front arrives on the third night. Preparing a shelter and keeping the fire burning through dawn unlocks a visible hearth upgrade. A failed attempt costs part of the next morning and can be retried three days later. Existing browser saves remain playable.

## Rules

- New games forecast a cold front on day 3. If missed, the next arrives on day 6, then day 9, until one is weathered. After success, this introductory event stops repeating.
- The front runs from the scheduled day's nightfall (160 seconds) to dawn (240 seconds). It burns fire fuel twice as fast. Without fire, warmth falls three times as fast as a normal sheltered night; outdoors it falls faster still. No death or permanent loss is added.
- At dawn, success requires the survivor inside the marked camp area, shelter built, fire still burning, and warmth above 20. Two fresh logs at nightfall provide 180 fuel seconds and cover the 160 fuel seconds required. An unprepared survivor wakes with at most 25 energy and begins 30 seconds into the next day. Sleep cannot bypass this consequence.
- Success unlocks the hearth build option. The hearth costs four wood and increases fuel from 90 to 150 seconds per wood. It changes the firepit art. It remains an optional permanent upgrade.

## Presentation

- A forecast card shows the storm day, the shelter condition, and the fire preparation needed. During the front it shows the remaining fuel needed to last until dawn. The card reports the retry or unlocked hearth after dawn.
- The storm has a visible cool tint and drifting wind marks. Arrival and outcome have short feedback messages. The existing day clock, sleep button, build buttons, and gentle movement rules remain usable.
- Hearth appears in the build panel as locked until the cold night is weathered; then its cost and availability are shown like other structures.

## Save compatibility

Save version 2 includes the next storm day, success state, and hearth structure. Valid version 1 saves load through a migration that leaves all old inventory, structures, meters, resources, and time intact. A migrated save gets at least two days of warning before its first storm. Invalid or unsupported saves remain unreadable without being overwritten.

## Verification

Rules tests cover forecast timing, double fuel use, success, failure, retry, sleep, and hearth fuel. Save tests cover version 2 round trips, version 1 migration, and rejection of invalid data. Browser checks cover forecast and build states, storm presentation, sleep outcome, saved progression, and continued play.

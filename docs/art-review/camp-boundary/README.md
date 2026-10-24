# Camp boundary review

Issue [#29](https://github.com/hobsojam/survival/issues/29) reported that the visible clearing and the gameplay radius disagree. The [prior Phase 6 camp view](../phase-6/fresh-camp.png) shows the old corner-interpolated clearing and twelve 8 px rim stones.

The new clearing uses a pixel-accurate four-tile circle. The four one-tile paths join its edge. A denser set of 14 × 12 px stones marks the gameplay boundary while leaving the path entrances clear. These screenshots use valid saves loaded with **Continue your camp**.

| Position | Desktop, 2× | Phone, 1× |
| --- | --- | --- |
| One tile inside the east boundary, at `(24, 15)` | [inside](desktop-inside.png) | [inside](phone-inside.png) |
| One tile outside, at `(25, 15)` | [outside](desktop-outside.png) | [outside](phone-outside.png) |

The [contact sheet](contact-sheet.png) shows two circle edge tiles and both rim-stone variants at 4× on grass, earth and night backgrounds.

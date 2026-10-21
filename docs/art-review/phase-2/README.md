# Phase 2 terrain and scaling review

These captures were made in headless Chromium from states built with `createGame()` and written with `saveGame()` (current save version 4). Each game capture is the canvas element. The `before/` images use `main` at `f138e6e`; the linked images use this branch. Cooking and stargazing still use the phase 1 survivor art; their dedicated animations belong to phase 4.

| Scene | Before | After |
| --- | --- | --- |
| Built camp | [Before](before/built-camp.png) | [After](built-camp.png) |
| Fresh camp | [Before](before/fresh-camp.png) | [After](fresh-camp.png) |
| Meadow | [Before](before/meadow.png) | [After](meadow.png) |
| Golden hour | [Before](before/dusk.png) | [After](dusk.png) |
| Night, fire lit | [Before](before/night-lit.png) | [After](night-lit.png) |
| Night, fire out | [Before](before/night-unlit.png) | [After](night-unlit.png) |
| Cold front | [Before](before/cold-front.png) | [After](cold-front.png) |
| Stone hearth | [Before](before/hearth.png) | [After](hearth.png) |
| Cooking | [Before](before/cooking.png) | [After](cooking.png) |
| Stargazing | [Before](before/stargazing.png) | [After](stargazing.png) |
| 390 px viewport | [Before](before/phone.png) | [After](phone.png) |
| 1920 px viewport | [Before](before/desktop-3x.png) | [After](desktop-3x.png) |
| Every sprite frame | [Before](before/contact-sheet.png) | [After](contact-sheet.png) |
| Survivor pixel alignment | — | [4× crop](survivor-crop-4x.png) |
| Value check | — | [Camp grayscale](built-camp-gray.png), [meadow grayscale](meadow-gray.png) |

Browser measurements: at 1400 px the canvas moved from `(51, 108.5)` to `(51, 108)` CSS pixels. At 1920 px it grew from 960 × 600 at 2× to 1440 × 900 at 3×. At 390 px it changed from a fractional 350.39 × 219 to 352 × 219 at 1×, showing a smaller world area. All after offsets were integers. No page errors were reported during these captures.

The forest border, groves, paths, clearing and rim stones are deterministic. Resource node and camp coordinates were not changed. The legacy phase 1 nodes, camp structures, survivor, lighting, and wildlife remain visible until their later art phases.

At 1400 × 820 in the same headless Chromium setup, one 180-frame sample measured mean frame intervals of 22.96 ms on `main` and 16.67 ms on this branch (95th percentile 33.4 ms and 16.8 ms respectively). These are browser frame intervals, not a standalone GPU benchmark.

# Phase 5 wildlife and effects review

The [Phase 4 screenshots](../phase-4/README.md) show the temporary wildlife before this change. These captures show the palette-indexed bird, fox, firefly, and scene effects after the change. They were taken from the local game canvas at 960×600 in Chromium; the capture script reported no page errors.

| Scene | Screenshot |
|---|---|
| Built camp, day | [built-camp](built-camp.png), [grayscale](built-camp-gray.png), [4× survivor crop](survivor-4x-crop.png) |
| Fresh camp, day | [fresh-camp](fresh-camp.png) |
| Meadow with ready and depleted nodes and birds | [meadow](meadow.png), [grayscale](meadow-gray.png) |
| Golden hour, fox arriving | [golden-hour](golden-hour.png) |
| Night, fox sitting | [night-sitting](night-sitting.png) |
| Night at time 200 with fire | [night-lit](night-lit.png) |
| Night with fire out | [night-unlit](night-unlit.png) |
| Cold front | [cold-front](cold-front.png) |
| Morning after a failed front | [failed-morning](failed-morning.png) |
| Built hearth | [hearth](hearth.png) |
| Gathering, cooking, stargazing | [gather](gather.png), [cook](cook.png), [stargaze](stargaze.png) |
| Phone viewport | [phone](phone.png) |
| Every wildlife and effect frame | [contact sheet](contact-sheet.png) |

The existing fox visit schedule has the fox leaving by `timeOfDay: 200`, so the additional `timeOfDay: 185` shot shows its sitting frames. The visit behavior itself remains unchanged.

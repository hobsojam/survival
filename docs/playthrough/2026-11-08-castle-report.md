# Playthrough check: from the finished keep to the castle made home

The same 31 scripted games as the [keep report](2026-11-07-report.md), now played on past the keep. Each game raises the castle, lays the feast, finishes the castle and moves into the great hall. No game numbers were changed for this check.

To regenerate the tables: `VITE_PLAYTHROUGH_REPORT=1 npx vitest run tests/playthrough.test.ts --disable-console-intercept --silent=false`

## In short

- **No dead ends.** All 31 games finished the castle and made the hall home, and nothing the panels offered was refused once it was paid for.
- **The castle takes about 130 to 205 days after the keep, depending on how the game is played.** Taking the middle game of each style, that is 127 days played in order, 166 days played actively and 205 days played slowly. At 40 days a year, that is roughly 3 to 5 years. The spec aimed for about 200 days of steady play, so the active games fall a little short.
- **Finishes are further apart than the spec hoped.** The spec asked for a finish every season or two, which is 10 to 20 days. Counting each wall side, tower, the gatehouse, the moat, the hall and the feast as a finish, the longest wait in the five test games runs from 16 to 41 days. The long waits are the first side of the wall, which takes 30 stone, and the hall, which waits on wool for its hangings.
- **More days are spent waiting.** "Days when all offers had to wait" went from 7 to 20 days (middle game) in the keep report to 64 to 119 days here. The castle years add slow waits, such as wool regrowing, spring rain for the moat and the season's apples for the feast.
- **Not measured: how much of the time goes on stone.** The plan asked for the share of time spent on stone, compared with the spec's "roughly half". The scripted player doesn't record time by kind of job yet, so this is left open.

## The castle's milestones

| Milestone | orderly: middle day (range) | wandering: middle day (range) | unhurried: middle day (range) |
| --- | --- | --- | --- |
| Finished the keep | 78 (78–78) | 78 (72–112) | 120 (101–153) |
| Saw the line of stones | 79 (79–79) | 79 (73–113) | 123 (112–154) |
| Laid the road to the keep | 91 (91–91) | 92 (80–128) | 141 (133–173) |
| Made the stone cart | 99 (99–99) | 101 (81–130) | 143 (140–183) |
| Raised the timber frames | 101 (101–101) | 103 (83–132) | 145 (143–185) |
| Finished the curtain wall | 137 (137–137) | 148 (138–182) | 204 (182–239) |
| Roofed and fitted the four towers | 158 (158–158) | 180 (170–212) | 248 (230–283) |
| Finished the gatehouse | 172 (172–172) | 174 (156–200) | 251 (215–271) |
| Dug the moat | 160 (160–160) | 183 (157–203) | 275 (269–309) |
| The spring rain filled the moat | 188 (188–188) | 188 (188–230) | 309 (271–311) |
| Built, roofed and hung the great hall | 190 (190–190) | 222 (181–224) | 255 (230–284) |
| Set the first dish on the hall's table | 191 (191–191) | 222 (181–224) | 291 (273–330) |
| Finished the castle with the feast | 205 (205–205) | 244 (204–247) | 325 (290–364) |
| Made the great hall home | 206 (206–206) | 245 (204–247) | 326 (291–364) |

## Full tables

### Outcomes

| Style | Games | Reached the keep | Keep finished (day: earliest, middle, latest) | Years | Play hours (middle) | Sick days | Days at hunger 20 or under |
| --- | --- | --- | --- | --- | --- | --- | --- |
| orderly | 1 | 1 | 78, 78, 78 | 1.9 | 3.1 | 0 | 0 |
| wandering | 15 | 15 | 72, 78, 112 | 1.9 | 3.4 | 0 | 2 |
| unhurried | 15 | 15 | 101, 120, 153 | 3.0 | 6.3 | 0 | 3 |

### When each milestone was reached

| Milestone | orderly: middle day (range) | wandering: middle day (range) | unhurried: middle day (range) |
| --- | --- | --- | --- |
| Built the shelter | 1 (1–1) | 1 (1–1) | 1 (1–1) |
| Built a bed | 2 (2–2) | 3 (1–8) | 12 (2–32) |
| Built the toolshed | 2 (2–2) | 2 (1–14) | 4 (2–19) |
| Weathered the cold night | 4 (4–4) | 4 (4–7) | 4 (4–7) |
| Made the stone axe | 4 (4–4) | 9 (4–18) | 14 (5–21) |
| Found the quarry | 8 (8–8) | 2 (1–10) | 6 (2–16) |
| Found the old homestead | 8 (8–8) | 2 (1–7) | 5 (2–18) |
| Made the pickaxe | 16 (16–16) | 14 (5–41) | 18 (8–43) |
| Repaired the lookout | 17 (17–17) | 13 (4–42) | 24 (14–76) |
| Cleared the first ground | 7 (7–7) | 18 (11–22) | 23 (11–30) |
| Built the woodpile | 21 (21–21) | 24 (13–50) | 45 (25–65) |
| Built the larder | 11 (11–11) | 28 (15–38) | 34 (12–65) |
| Moved into the house | 51 (51–51) | 59 (44–84) | 93 (85–121) |
| Built the vegetable beds | 27 (27–27) | 22 (14–32) | 38 (17–69) |
| Built the well | 43 (43–43) | 54 (27–74) | 77 (54–114) |
| Built the workshop | 33 (33–33) | 44 (34–57) | 62 (48–80) |
| Built the grain field | 28 (28–28) | 32 (19–50) | 53 (28–79) |
| Threshed the first grain | 36 (36–36) | 75 (38–75) | 75 (64–115) |
| Built the granary | 30 (30–30) | 36 (22–59) | 67 (44–111) |
| Built the windmill | 58 (58–58) | 62 (51–84) | 100 (67–127) |
| Built the bakery | 63 (63–63) | 78 (59–88) | 122 (85–140) |
| Built the beehive | 12 (12–12) | 30 (18–36) | 43 (34–69) |
| Built the chicken coop | 13 (13–13) | 12 (4–17) | 14 (11–29) |
| Led the chickens home | 14 (14–14) | 13 (4–18) | 18 (12–39) |
| Built the sheep pen | 28 (28–28) | 37 (31–63) | 64 (41–95) |
| The sheep arrived | 37 (37–37) | 77 (39–77) | 77 (66–120) |
| Sheared the flock | 61 (61–61) | 102 (61–104) | 101 (101–143) |
| Built the loom | 61 (61–61) | 106 (63–117) | 122 (103–154) |
| Fenced the orchard | 38 (38–38) | 35 (15–45) | 56 (39–115) |
| Planted the first apple tree | 39 (39–39) | 35 (21–46) | 61 (39–119) |
| Cleared all the ground | 38 (38–38) | 34 (25–65) | 60 (41–81) |
| Came out on the hills | 13 (13–13) | 5 (2–11) | 8 (3–23) |
| Found ore | 16 (16–16) | 18 (7–42) | 26 (15–74) |
| Added the forge | 54 (54–54) | 55 (45–74) | 80 (52–101) |
| Won over the pony | 67 (67–67) | 42 (27–70) | 79 (72–138) |
| Shod the pony | 67 (67–67) | 62 (55–77) | 100 (83–138) |
| Made the iron hinges | 57 (57–57) | 57 (48–76) | 86 (69–106) |
| Laid the keep's first stone | 58 (58–58) | 57 (51–79) | 92 (68–107) |
| Hung the keep's door | 68 (68–68) | 68 (62–99) | 108 (85–136) |
| Finished the keep | 78 (78–78) | 78 (72–112) | 120 (101–153) |
| Saw the line of stones | 79 (79–79) | 79 (73–113) | 123 (112–154) |
| Laid the road to the keep | 91 (91–91) | 92 (80–128) | 141 (133–173) |
| Made the stone cart | 99 (99–99) | 101 (81–130) | 143 (140–183) |
| Raised the timber frames | 101 (101–101) | 103 (83–132) | 145 (143–185) |
| Finished the curtain wall | 137 (137–137) | 148 (138–182) | 204 (182–239) |
| Roofed and fitted the four towers | 158 (158–158) | 180 (170–212) | 248 (230–283) |
| Finished the gatehouse | 172 (172–172) | 174 (156–200) | 251 (215–271) |
| Dug the moat | 160 (160–160) | 183 (157–203) | 275 (269–309) |
| The spring rain filled the moat | 188 (188–188) | 188 (188–230) | 309 (271–311) |
| Built, roofed and hung the great hall | 190 (190–190) | 222 (181–224) | 255 (230–284) |
| Set the first dish on the hall's table | 191 (191–191) | 222 (181–224) | 291 (273–330) |
| Finished the castle with the feast | 205 (205–205) | 244 (204–247) | 325 (290–364) |
| Made the great hall home | 206 (206–206) | 245 (204–247) | 326 (291–364) |

### Longest stretch with no new milestone

| Style | Longest gap, middle game | Longest gap, worst game |
| --- | --- | --- |
| orderly | 10 days: Hung the keep's door → Finished the keep | 10 days: Hung the keep's door → Finished the keep |
| wandering | 9 days: Built the granary → Built the workshop | 13 days: Built the workshop → Built the windmill |
| unhurried | 15 days: Built the larder → Cleared all the ground | 25 days: Hung the keep's door → Finished the keep |

### Friction

| Style | Days with nothing offered (total) | Days when all offers had to wait (middle) | Bag too full (middle) | Cost too big for bag and stores (total) | Offers refused when paid for | Left undone at the end |
| --- | --- | --- | --- | --- | --- | --- |
| orderly | 0 | 73 | 47 | 0 | 0 | build:birdhouse |
| wandering | 0 | 119 | 90 | 1 | 0 | build:wolfHouse, build:birdhouse, build:foxDen |
| unhurried | 0 | 64 | 206 | 3 | 0 | build:wolfHouse, build:foxDen |

### What the game was saying

| Style | "You have followed every path" showing before the keep is done (middle days) | Games where it showed before reaching the hills | "No structures left to build" while some were unbuilt (middle days) | Still unbuilt during that line |
| --- | --- | --- | --- | --- |
| orderly | 0 | 0 | 184 | birdhouse |
| wandering | 47 | 0 | 196 | wolfHouse, loom, birdhouse, foxDen |
| unhurried | 65 | 0 | 26 | loom, wolfHouse, foxDen |


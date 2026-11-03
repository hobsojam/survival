# The quarry's look

## Intent

The user's words: "the quarry area is ugly. for example the path looks bad." A screenshot at their laptop's size showed four problems:

- **The path** is a thin strip with a dark outline that kinks at every tile. It stops in a rounded stub short of the quarry, and a tree clump grows over it.
- **Bare ground** lies in hard-edged 16-pixel squares scattered at random, so the area looks like a patchwork.
- **The quarry** is a small stack of grey slabs on a dirt patch, and doesn't read as a quarry.
- **The woods** are thin at the edges and clumped at random, so the area doesn't feel like a clearing in the forest the way the camp does.

The user wants both the ground and the quarry itself fixed. Of three mockups (a cut rock face, a stepped pit, a rocky outcrop), they chose **the cut rock face**.

## Goals

- **The quarry face.** A grey cliff along the west side of the area, with a grassy lip on top and square cut marks in the stone. It replaces today's slab stack as the thing you dig. Its two looks stay: ready to dig, and worked out until morning.
- **The quarry floor.** A pale gravel floor spreads from the foot of the face, with soft, uneven edges blending into the grass. The rubble heap and a few stacked cut blocks sit on it. This and the track are the only bare ground in the area.
- **The track.** A worn, wider dirt track runs from the signpost by the east exit to the quarry floor. It has soft edges, no dark outline and a few pebbles, and no tree stands on or over it.
- **The woods.** A fuller band of trees along the north, south and east edges, like the camp's ring of woods, with a couple of clumps and the existing boulders inside, all clear of the track and the floor.

## Non-goals

- **No change to play.** Digging the face, gathering rubble, loose stone piles, the timers, the prompts, the costs, and walking in and out all stay exactly as they are.
- **The camp is unchanged,** including its paths.
- **No new winter or seasonal art for the quarry.** It follows whatever the season does to the area today.

## Anti-goals

- **Moving where things are done in a way that breaks habits or saves.** The face, rubble and exit may move a little for the art, but a saved camp standing in the quarry must still load and play. Nothing new goes into the save.
- **Losing the pixel-art look.** Everything is drawn in code in the game's palette, like the rest of the art. No smoothed or anti-aliased edges.
- **Clutter.** The floor and track should read clearly at a glance, so decorations stay off them.

## Left to the builder

- Whether the face is one large sprite, a run of terrain tiles, or both, and its exact size and position along the west side. The dig target (`QUARRY_SITE`) and the rubble (`RUBBLE_SITE`) may move to suit the art, as long as they stay reachable on the floor, and the tests and prompts follow them.
- How the soft edges of the floor and track are drawn: blended tiles, dithered decals, or a ground layer.
- The exact tree band, clump and boulder spots.
- How the worked-out look differs from the ready one.
- The README's quarry wording, if any of it describes the look.

# Lookout Goal Design

The player can find a damaged lookout at tile (30, 8), near the northeast path. It remains visible from day one. After weathering a cold front, the player can repair it with 4 wood, 2 fiber, and 2 stone while standing within two tiles. Repair takes 12 seconds and 6 energy, following existing building rules. The cost fits the starting eight-item bag.

The sidebar shows the next objective: prepare for the cold front, travel to the lookout after success, gather the repair materials, then enjoy the restored view. A button and the L key can repair it when nearby. The site changes from damaged to restored pixel art. A short completion overlay appears only when repair succeeds in the current session; closing it resumes free play. Existing saves load with the lookout still damaged, preserving all prior progression.

Tests cover locked, distant, insufficient, and successful repair; migration and round-trip saves; and visual states. No additional resource or meter is introduced.

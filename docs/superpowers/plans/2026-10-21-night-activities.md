# Night Activities Plan

**Goal:** Give the survivor two optional things to do at night without changing save data or survival requirements.

**Scope:** Add a short berry cooking action and a stargazing action. Both start only at night and at camp. Cooking also needs one berry and a lit fire; it consumes the berry, takes eight seconds, restores 35 hunger and 10 warmth, and uses fire fuel through normal time passage. Stargazing takes twelve seconds, restores 10 energy, and offers a small rotating line of nighttime flavor. Neither is needed to survive. The actions appear in a Night at camp panel and have C and G shortcuts.

**Verification:** Unit tests cover conditions, resource use, meter bounds, time advancement, and dawn rollover. Build and browser checks cover the panel, shortcuts, feedback, and a narrow viewport. Update the README.

**Integration:** Branch independently from the updated main, then open a PR for issue #3. Any shared UI or rules changes with the pending cold-night PR are resolved at merge time.

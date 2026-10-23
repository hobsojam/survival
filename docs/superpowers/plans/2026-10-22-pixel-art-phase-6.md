# Pixel Art Phase 6 Plan

Goal: replace the flat night overlay with the approved time-of-day lighting layer and stepped light cutouts, preserving gameplay and scene art.

1. Add pure lighting calculations with tests: day, dusk, night, dawn and storm tints; fuel and hearth radii; four-frame one-pixel flicker; whole-pixel screen coordinates.
2. Implement one full-screen Phaser RenderTexture above the world. Refill it from the palette tint each frame and erase three hard-edged light bands for the fire; erase small stepped lights for fireflies. Resize it for the logical phone viewport.
3. Integrate it into `GameScene` in place of the old night rectangle. Keep the Phase 5 wind and sleet sprites above it; confirm the existing fire sprites select windy frames during storms.
4. Capture the review scenes, native-pixel crop and grayscale copies. Check firelight with high/low/no fuel, hearth, dawn/dusk, storm, phone and the contact sheet. Run tests, build, diff checks and read-only code review. Open one Part 6 PR.

Constraints: no game-rule, balance, save or map-coordinate changes; no newly introduced nested ternaries. Preserve integer art scale and scene depth ordering.

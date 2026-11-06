import type { SceneVisual } from './visuals';

/** How fast a sheep crosses the pen, in pixels a second: about a tile in a second and a half. */
const WALK_SPEED = 11;
/** How often a walking sheep changes its step, as the drifting ones do. */
const STEP_MS = 320;

const SHEEP_ID = /^sheep-\d+$/;
const SNOW_ID = /^sheep-\d+-snow$/;

/**
 * Sends each sheep on foot to wherever `sceneVisuals` puts it, so going to the rack, leaving it or growing into a cloud
 * is a walk across the pen and not a jump. A sheep out of view is forgotten and comes back on its spot.
 */
export class SheepWalk {
  private readonly shown = new Map<string, { x: number; y: number }>();
  private lastMs = 0;

  apply(visuals: readonly SceneVisual[], nowMs: number): SceneVisual[] {
    const reach = (WALK_SPEED * Math.max(0, nowMs - this.lastMs)) / 1000;
    this.lastMs = nowMs;
    const inView = new Set<string>();
    const shifts = new Map<string, { dx: number; dy: number }>();
    const moved = visuals.map(visual => {
      if (!SHEEP_ID.test(visual.id)) return visual;
      inView.add(visual.id);
      const from = this.shown.get(visual.id) ?? visual;
      const gap = Math.hypot(visual.x - from.x, visual.y - from.y);
      if (gap <= reach) {
        this.shown.set(visual.id, { x: visual.x, y: visual.y });
        return visual;
      }
      const x = from.x + ((visual.x - from.x) / gap) * reach;
      const y = from.y + ((visual.y - from.y) / gap) * reach;
      this.shown.set(visual.id, { x, y });
      shifts.set(visual.id, { dx: x - visual.x, dy: y - visual.y });
      const step = Math.floor(nowMs / STEP_MS) % 2 === 1 ? 'Walk' : 'Idle';
      return { ...visual, x, y, depth: visual.depth + (y - visual.y) / 1000, texture: visual.texture.replace(/(Walk|Idle)$/, step) };
    });
    for (const id of this.shown.keys()) if (!inView.has(id)) this.shown.delete(id);
    return moved.map(visual => {
      const shift = SNOW_ID.test(visual.id) ? shifts.get(visual.id.replace(/-snow$/, '')) : undefined;
      return shift ? { ...visual, x: visual.x + shift.dx, y: visual.y + shift.dy, depth: visual.depth + shift.dy / 1000 } : visual;
    });
  }
}

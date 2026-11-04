import { sprites } from '../art/sprites';
import { nameOf, type NameTarget } from '../game/names';
import type { Friend, GameState } from '../game/state';
import { worldX, worldY } from './art';
import type { CompanionPose } from './companionPose';
import { pickTapTarget } from './tapTarget';
import { sceneVisuals } from './visuals';

// Which unnamed animal a tap landed on. It has to land on the animal itself and on nothing else that can be tapped,
// so a player who never names anything never gets asked by accident.

export type DrawnFriend = CompanionPose & { animal: Friend };

/** What only the running scene knows: its friends as last drawn, how long the survivor has stood still, and whether a replay is ignoring input. */
export interface TapScene { friends: readonly DrawnFriend[]; stillSeconds: number; replaying: boolean }
const NO_SCENE: TapScene = { friends: [], stillSeconds: 0, replaying: false };
/** Friends trail a walking survivor, so one only counts as tapped once the survivor has stopped and it has settled. */
const SETTLED_SECONDS = 0.5;

interface Painted { target: NameTarget; sprite: string; frame: string; x: number; y: number; depth: number; facing: 1 | -1 }

/** Whether the world pixel falls on a painted part of the picture, leaving out its shadow. */
function onPicture({ sprite, frame, x, y, facing }: Painted, pixelX: number, pixelY: number): boolean {
  const def = sprites[sprite];
  const rows = def.frames[frame];
  if (!rows) return false;
  const across = Math.floor(pixelX - x) * facing + def.anchor[0];
  const cell = rows[Math.floor(pixelY - y) + def.anchor[1]]?.[across];
  return cell !== undefined && cell !== '.' && def.legend[cell] !== 'shadow';
}

function drawnFlock(state: GameState, timeMs: number): Painted[] {
  const painted: Painted[] = [];
  for (const visual of sceneVisuals(state, timeMs)) {
    const match = /^(sheep|chicken)-(\d)$/.exec(visual.id);
    if (!match) continue;
    const [sprite, frame] = visual.texture.split(':');
    const target: NameTarget = match[1] === 'sheep' ? { kind: 'sheep', index: Number(match[2]) } : { kind: 'chicken', index: Number(match[2]) };
    painted.push({ target, sprite, frame, x: visual.x, y: visual.y, depth: visual.depth, facing: 1 });
  }
  return painted;
}

function drawnFriends(friends: readonly DrawnFriend[]): Painted[] {
  return friends.map(({ animal, x, y, height, frame: texture, facing }) => {
    const groundY = worldY(y);
    const [sprite, frame] = texture.split(':');
    return { target: { kind: 'friend', animal }, sprite, frame, x: Math.round(worldX(x)), y: Math.round(worldY(y - height)), depth: groundY, facing };
  });
}

/** The unnamed animal drawn under a tap, in tile units, or null. Anything else that can be tapped at that spot wins. */
export function unnamedAnimalAt(state: GameState, timeMs: number, x: number, y: number, scene: TapScene = NO_SCENE): NameTarget | null {
  if (scene.replaying || state.area !== 'camp' || pickTapTarget(state, x, y).kind !== 'ground') return null;
  const flock = drawnFlock(state, timeMs).filter(animal => animal.target.kind === 'sheep' || state.chickens.rescued);
  const pixelX = worldX(x);
  const pixelY = worldY(y);
  const under = [...flock, ...(scene.stillSeconds > SETTLED_SECONDS ? drawnFriends(scene.friends) : [])]
    .filter(animal => nameOf(state, animal.target) === null && onPicture(animal, pixelX, pixelY))
    .sort((a, b) => b.depth - a.depth);
  return under[0]?.target ?? null;
}

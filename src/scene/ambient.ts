import { BALANCE, type ResourceNode } from '../game/state';
import { nightStart } from '../game/calendar';
import { WOLF_LOW_FUEL } from '../game/wolves';
import { RABBIT_HOMES, dayHash as hash, type Point } from '../game/wildlife';

// Ambient life is decoration only: it reads game state but never changes or saves it.
// Positions are in tiles, like the game state.

export type { Point };
export { FOX, foxAt, foxVisits, foxWindow, type FoxPose } from '../game/wildlife';
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** 0 in daylight, 1 in deep night; eases in after nightfall and out after dawn. */
export function darkness(day: number, timeOfDay: number): number {
  const night = nightStart(day);
  if (timeOfDay >= night) return Math.min(1, (timeOfDay - night) / 30);
  if (day > 1 && timeOfDay < 25) return 1 - timeOfDay / 25;
  return 0;
}

export const BIRD_HOMES: Point[] = [
  { x: 11.5, y: 21 }, { x: 12.6, y: 21.6 }, { x: 11.9, y: 22.4 },
  { x: 27.5, y: 6.4 }, { x: 28.4, y: 7.1 }
];
export const BIRD_FLEE_RADIUS = 2.5;
export const BIRD_FORAGE_RADIUS = 7;

/** A bird makes one chance roll per trip and only visits a ready bush nearby. */
export function birdForageTarget(home: Point, nodes: ResourceNode[], chance: number): ResourceNode | null {
  if (chance >= 0.5) return null;
  const nearby = nodes.filter(node => node.kind === 'berry' && node.amount > 0 && distance(home, node) <= BIRD_FORAGE_RADIUS);
  nearby.sort((left, right) => distance(home, left) - distance(home, right));
  return nearby[0] ?? null;
}

export const birdShouldLeave = (home: Point, player: Point, dark: number) =>
  dark > 0.3 || distance(home, player) < BIRD_FLEE_RADIUS;

export const birdMayReturn = (home: Point, player: Point, dark: number) =>
  dark < 0.1 && distance(home, player) > BIRD_FLEE_RADIUS + 2;

/** Fireflies gather in a loose ring around camp, where the player spends nights. */
export const FIREFLY_HOMES: Point[] = Array.from({ length: 22 }, (_, i) => {
  const angle = hash(i + 101) * Math.PI * 2;
  const radius = 4.5 + hash(i + 211) * 7;
  return {
    x: Math.min(BALANCE.mapWidth - 2, Math.max(1, BALANCE.campX + Math.cos(angle) * radius)),
    y: Math.min(BALANCE.mapHeight - 2, Math.max(1, BALANCE.campY + Math.sin(angle) * radius))
  };
});

export function fireflyOffset(index: number, timeMs: number): Point {
  return {
    x: Math.sin(timeMs / 2300 + index) * 1.2 + Math.sin(timeMs / 870 + index * 3) * 0.25,
    y: Math.cos(timeMs / 2900 + index * 1.7) * 0.9 + Math.cos(timeMs / 1100 + index) * 0.2
  };
}

/** Brightness 0–1: each firefly pulses slowly on its own rhythm, only after dark. */
export function fireflyGlow(index: number, timeMs: number, dark: number): number {
  const pulse = 0.5 + 0.5 * Math.sin(timeMs / (600 + hash(index + 307) * 500) + index * 2.3);
  return dark * pulse * pulse;
}

/** Where autumn leaves start: two under the crown of each broadleaf tree at camp. */
export const LEAF_HOMES: (Point & { treeId: string })[] = [
  { x: 19.6, y: 5.6, treeId: 'tree-0' }, { x: 20.8, y: 6.2, treeId: 'tree-0' },
  { x: 16.6, y: 7.6, treeId: 'tree-1' }, { x: 17.8, y: 8.2, treeId: 'tree-1' },
  { x: 26.6, y: 3.6, treeId: 'tree-2' }, { x: 27.6, y: 4.2, treeId: 'tree-2' }
];
const LEAF_CYCLE = 9;
const LEAF_FALL = 4;
const LEAF_FADE = 0.5;

/** One leaf: it tumbles two tiles down for 4 s of every 9 s, swaying side to side, and fades in and out at the ends. */
export function leafAt(index: number, timeMs: number): { x: number; y: number; alpha: number; frame: 'leaf:fall0' | 'leaf:fall1' } | null {
  const phase = (timeMs / 1000 + index * 1.5) % LEAF_CYCLE;
  if (phase >= LEAF_FALL) return null;
  const home = LEAF_HOMES[index];
  const progress = phase / LEAF_FALL;
  return {
    x: home.x + Math.sin(phase * 2.4 + index) * 0.6,
    y: home.y + progress * 2,
    alpha: Math.min(1, phase / LEAF_FADE, (LEAF_FALL - phase) / LEAF_FADE),
    frame: Math.floor(phase * 3) % 2 ? 'leaf:fall1' : 'leaf:fall0'
  };
}

/** Pairs of eyes that watch from the dark edges of the quarry. They are only a look; nothing follows the survivor. */
export const EYE_SPOTS: Point[] = [
  { x: 4, y: 5 }, { x: 9, y: 22 }, { x: 19, y: 6 }, { x: 22, y: 21 }, { x: 28, y: 11 }, { x: 33, y: 25 }
];
const EYE_CYCLE = 12;
const EYE_WINDOW = 6;
const EYE_NEAR = 4;
const EYE_FAR = 6;

/**
 * One pair of eyes: visible about 6 s of every 12 s (three pairs at a time), only in the dark.
 * Near the survivor a pair backs off up to a tile and fades out completely by 4 tiles.
 */
export function eyesAt(index: number, timeMs: number, dark: number, player: Point, spots: Point[] = EYE_SPOTS):
  { x: number; y: number; alpha: number; frame: 'open' | 'blink' } | null {
  if (dark < 0.5) return null;
  const spot = spots[index];
  const seconds = timeMs / 1000;
  const phase = (seconds + index * 2) % EYE_CYCLE;
  if (phase >= EYE_WINDOW) return null;
  const away = distance(spot, player);
  if (away < EYE_NEAR) return null;
  const near = Math.max(0, Math.min(1, (EYE_FAR - away) / (EYE_FAR - EYE_NEAR)));
  const dx = away > 0 ? (spot.x - player.x) / away : 0;
  const dy = away > 0 ? (spot.y - player.y) / away : 0;
  const edge = Math.min(1, Math.min(phase, EYE_WINDOW - phase) / 0.6);
  const blinking = (seconds + index * 0.7) % 3.5 > 3.25;
  return {
    x: spot.x + dx * near, y: spot.y + dy * near,
    alpha: Math.min(1, dark) * edge * (1 - near),
    frame: blinking ? 'blink' : 'open'
  };
}

/** Where wolves watch the camp from on winter nights: about seven tiles out from the fire, clear of the trees. */
export const WOLF_SPOTS: Point[] = [{ x: 13.5, y: 12.5 }, { x: 26.5, y: 18.5 }, { x: 17.5, y: 21.5 }];

/** One to three wolves, the same on any given night. */
export const wolfCount = (day: number): number => 1 + Math.floor(hash(day + 17) * 3);

/** How strongly the wolves press in: not at all with 20 s of fuel, fully once the fire is out. */
export const wolfWatch = (fireFuel: number): number => Math.max(0, Math.min(1, (WOLF_LOW_FUEL - fireFuel) / 10));

export { RABBIT_HOMES };
export const RABBIT_FLEE_RADIUS = 2.5;
const RABBIT_SPOTS: readonly Point[] = [{ x: 0, y: 0 }, { x: 0.6, y: 0.3 }, { x: -0.5, y: 0.4 }, { x: 0.2, y: -0.5 }];
const RABBIT_CYCLE = 6;

/** Two or three rabbits, the same on any given day. */
export const rabbitCount = (day: number): number => 2 + Math.floor(hash(day + 31) * 2);

/** One rabbit's 6 s round: it sits for 2 s, nibbles for 2 s, then hops to the next of four spots near home. */
export function rabbitAt(index: number, timeMs: number): { x: number; y: number; frame: string; facing: 1 | -1 } {
  const seconds = timeMs / 1000 + index * 1.9;
  const cycle = Math.floor(seconds / RABBIT_CYCLE);
  const phase = seconds - cycle * RABBIT_CYCLE;
  const home = RABBIT_HOMES[index];
  const from = RABBIT_SPOTS[cycle % 4];
  const to = RABBIT_SPOTS[(cycle + 1) % 4];
  const facing = to.x < from.x ? -1 : 1;
  if (phase < 2) return { x: home.x + from.x, y: home.y + from.y, frame: 'rabbit:sit', facing };
  if (phase < 4) return { x: home.x + from.x, y: home.y + from.y, frame: `rabbit:nibble${Math.floor((phase - 2) / 0.2) % 2}`, facing };
  const progress = (phase - 4) / 2;
  return {
    x: home.x + from.x + (to.x - from.x) * progress, y: home.y + from.y + (to.y - from.y) * progress,
    frame: `rabbit:hop${Math.floor((phase - 4) / 0.15) % 2}`, facing
  };
}

export function birdGroundFrame(index: number, timeMs: number): string {
  const phase = (timeMs / 1000 + index * 1.37) % 4;
  if (phase > 3.6) return 'bird:hop';
  if (phase >= 2.6 && phase < 3.2) return `bird:peck${Math.floor((phase - 2.6) / 0.15) % 2}`;
  return 'bird:idle';
}

export function birdFlightFrame(elapsedSeconds: number): string {
  return `bird:fly${Math.floor(elapsedSeconds * 12) % 2}`;
}

export function foxFrame(pose: 'trot' | 'run' | 'sit', elapsedSeconds: number): string {
  let frameRate = 10;
  let frameCount = 4;
  if (pose === 'run') frameRate = 14;
  if (pose === 'sit') { frameRate = 2; frameCount = 2; }
  return `fox:${pose}${Math.floor(elapsedSeconds * frameRate) % frameCount}`;
}

export function fireflyFrame(index: number, timeMs: number): string {
  return `firefly:glow${Math.floor(timeMs / 500 + index) % 2}`;
}

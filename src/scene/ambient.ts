import { BALANCE } from '../game/state';

// Ambient life is decoration only: it reads game state but never changes or saves it.
// Positions are in tiles, like the game state.

export interface Point { x: number; y: number }

const hash = (n: number) => {
  const value = Math.sin(n * 12.9898) * 43758.5453;
  return value - Math.floor(value);
};
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** 0 in daylight, 1 in deep night; eases in after nightfall and out after dawn. */
export function darkness(day: number, timeOfDay: number): number {
  if (timeOfDay >= BALANCE.nightStart) return Math.min(1, (timeOfDay - BALANCE.nightStart) / 30);
  if (day > 1 && timeOfDay < 25) return 1 - timeOfDay / 25;
  return 0;
}

export const FOX = {
  arrive: BALANCE.nightStart - 20,
  leave: BALANCE.nightStart + 50,
  travel: 12,
  den: { x: 26, y: -1 },
  seat: { x: 20.8, y: 11.6 },
  spookRadius: 2
} as const;

export interface FoxPose extends Point { sitting: boolean; facing: 1 | -1 }

/** The fox comes by on the first evening, then on roughly two evenings in three. */
export const foxVisits = (day: number) => day === 1 || hash(day) < 0.65;

export function foxAt(day: number, timeOfDay: number): FoxPose | null {
  if (!foxVisits(day) || timeOfDay < FOX.arrive || timeOfDay > FOX.leave) return null;
  const progress = Math.min(1, (timeOfDay - FOX.arrive) / FOX.travel, (FOX.leave - timeOfDay) / FOX.travel);
  const leaving = timeOfDay - FOX.arrive > FOX.leave - timeOfDay;
  const sitting = progress >= 1;
  // Sitting, the fox faces the fire; walking, it faces where it's going.
  let heading: number;
  if (sitting) heading = BALANCE.campX - FOX.seat.x;
  else if (leaving) heading = FOX.den.x - FOX.seat.x;
  else heading = FOX.seat.x - FOX.den.x;
  return {
    x: FOX.den.x + (FOX.seat.x - FOX.den.x) * progress,
    y: FOX.den.y + (FOX.seat.y - FOX.den.y) * progress,
    sitting,
    facing: heading < 0 ? -1 : 1
  };
}

export const BIRD_HOMES: Point[] = [
  { x: 11.5, y: 21 }, { x: 12.6, y: 21.6 }, { x: 11.9, y: 22.4 },
  { x: 27.5, y: 6.4 }, { x: 28.4, y: 7.1 }
];
export const BIRD_FLEE_RADIUS = 2.5;

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

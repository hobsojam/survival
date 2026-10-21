import Phaser from 'phaser';
import type { GameState } from '../game/state';
import { worldX, worldY } from './art';
import {
  BIRD_HOMES, FIREFLY_HOMES, FOX, birdMayReturn, birdShouldLeave, darkness, fireflyGlow, fireflyOffset, foxAt, type Point
} from './ambient';

interface Flight { from: Point; to: Point; elapsed: number; duration: number; leaving: boolean }
interface Bird { home: Point; away: Point | null; flight: Flight | null; restSeconds: number; index: number }

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const FLIGHT_SECONDS = 1.6;
const FOX_RUN_SECONDS = 2.2;
const BIRD_SCALE = 1.6;
const FOX_SCALE = 1.3;

/** Draws a creature around (0, 0), then places and scales it in the world. */
function placed(g: Phaser.GameObjects.Graphics, x: number, y: number, scale: number, draw: () => void): void {
  g.save();
  g.translateCanvas(x, y);
  g.scaleCanvas(scale, scale);
  draw();
  g.restore();
}

/** Birds, a visiting fox, and fireflies. Purely visual: reads game state, never writes it. */
export class AmbientLife {
  private readonly creatures: Phaser.GameObjects.Graphics;
  private readonly lights: Phaser.GameObjects.Graphics;
  private readonly birds: Bird[];
  private foxRun: Flight | null = null;
  private foxFledDay = 0;
  private started = false;

  constructor(scene: Phaser.Scene) {
    // Creatures sit under the night tint; firefly light shines through it.
    this.creatures = scene.add.graphics().setDepth(15);
    this.lights = scene.add.graphics().setDepth(102).setBlendMode(Phaser.BlendModes.ADD);
    this.birds = BIRD_HOMES.map((home, index) => ({ home, away: null, flight: null, restSeconds: 0, index }));
  }

  update(state: GameState, seconds: number, timeMs: number): void {
    const dark = darkness(state.day, state.timeOfDay);
    if (!this.started) {
      // Loading into a night shouldn't show every bird taking off at once.
      this.started = true;
      if (dark > 0.3) for (const bird of this.birds) bird.away = { x: bird.home.x, y: bird.home.y - 9 };
    }
    this.creatures.clear();
    this.lights.clear();
    for (const bird of this.birds) this.updateBird(bird, state.player, dark, seconds, timeMs);
    this.updateFox(state, seconds, timeMs);
    this.drawFireflies(dark, timeMs);
  }

  private updateBird(bird: Bird, player: Point, dark: number, seconds: number, timeMs: number): void {
    bird.restSeconds = Math.max(0, bird.restSeconds - seconds);
    if (bird.flight) {
      const flight = bird.flight;
      flight.elapsed += seconds;
      const progress = Math.min(1, flight.elapsed / flight.duration);
      const height = (flight.leaving ? progress : 1 - progress) * 26;
      const alpha = flight.leaving ? Math.min(1, (1 - progress) / 0.3) : Math.min(1, progress / 0.3);
      const x = lerp(flight.from.x, flight.to.x, progress);
      const y = lerp(flight.from.y, flight.to.y, progress);
      const facing = Math.sign(flight.to.x - flight.from.x) || 1;
      placed(this.creatures, worldX(x), worldY(y), BIRD_SCALE, () => drawFlyingBird(this.creatures, 0, 0, height, facing, timeMs, alpha));
      if (progress >= 1) {
        bird.away = flight.leaving ? flight.to : null;
        bird.flight = null;
        if (flight.leaving) bird.restSeconds = 8 + bird.index * 2.5;
      }
      return;
    }
    if (!bird.away && birdShouldLeave(bird.home, player, dark)) {
      const angle = dark > 0.3
        ? -Math.PI / 2 + (bird.index - 2) * 0.5
        : Math.atan2(bird.home.y - player.y, bird.home.x - player.x) + (bird.index - 2) * 0.25;
      const to = { x: bird.home.x + Math.cos(angle) * 9, y: bird.home.y + Math.sin(angle) * 9 };
      bird.flight = { from: bird.home, to, elapsed: 0, duration: FLIGHT_SECONDS, leaving: true };
    } else if (bird.away && bird.restSeconds <= 0 && birdMayReturn(bird.home, player, dark)) {
      bird.flight = { from: bird.away, to: bird.home, elapsed: 0, duration: FLIGHT_SECONDS * 1.4, leaving: false };
    } else if (!bird.away) {
      placed(this.creatures, worldX(bird.home.x), worldY(bird.home.y), BIRD_SCALE, () => drawGroundBird(this.creatures, 0, 0, bird.index, timeMs));
    }
  }

  private updateFox(state: GameState, seconds: number, timeMs: number): void {
    if (this.foxRun) {
      const run = this.foxRun;
      run.elapsed += seconds;
      const progress = Math.min(1, run.elapsed / run.duration);
      const x = lerp(run.from.x, run.to.x, progress);
      const y = lerp(run.from.y, run.to.y, progress);
      const facing = Math.sign(run.to.x - run.from.x) || 1;
      placed(this.creatures, worldX(x), worldY(y), FOX_SCALE, () => drawFox(this.creatures, 0, 0, false, facing, timeMs * 1.8));
      if (progress >= 1) this.foxRun = null;
      return;
    }
    if (this.foxFledDay === state.day) return;
    const pose = foxAt(state.day, state.timeOfDay);
    if (!pose) return;
    if (Math.hypot(pose.x - state.player.x, pose.y - state.player.y) < FOX.spookRadius) {
      this.foxFledDay = state.day;
      this.foxRun = { from: pose, to: FOX.den, elapsed: 0, duration: FOX_RUN_SECONDS, leaving: true };
      return;
    }
    placed(this.creatures, worldX(pose.x), worldY(pose.y), FOX_SCALE, () => drawFox(this.creatures, 0, 0, pose.sitting, pose.facing, timeMs));
  }

  private drawFireflies(dark: number, timeMs: number): void {
    if (dark <= 0) return;
    FIREFLY_HOMES.forEach((home, index) => {
      const glow = fireflyGlow(index, timeMs, dark);
      if (glow < 0.02) return;
      const offset = fireflyOffset(index, timeMs);
      const x = worldX(home.x + offset.x);
      const y = worldY(home.y + offset.y);
      this.lights.fillStyle(0xc8f07a, 0.18 * glow);
      this.lights.fillCircle(x, y, 9);
      this.lights.fillStyle(0xf4ffb8, 0.85 * glow);
      this.lights.fillCircle(x, y, 2);
    });
  }
}

function drawGroundBird(g: Phaser.GameObjects.Graphics, x: number, y: number, index: number, timeMs: number): void {
  // Each bird alternates between looking about, pecking, and the odd hop.
  const cycle = (timeMs / 1000 + index * 1.37) % 4;
  const pecking = cycle > 2.6 && cycle < 3.3;
  const hop = cycle > 3.6 ? Math.sin((cycle - 3.6) / 0.4 * Math.PI) * 4 : 0;
  const facing = index % 2 ? 1 : -1;
  const by = y - hop;
  g.fillStyle(0x20372f, 0.3);
  g.fillEllipse(x, y + 5, 12, 4);
  g.fillStyle(0x8a6a52);
  g.fillEllipse(x, by, 12, 8);
  g.fillStyle(0x5e4636);
  g.fillTriangle(x - facing * 5, by - 1, x - facing * 11, by - 3, x - facing * 10, by + 1);
  g.fillStyle(0xe2c29a);
  g.fillEllipse(x + facing * 1.5, by + 1.5, 7, 4);
  const hx = x + facing * (pecking ? 6 : 5);
  const hy = by + (pecking ? 2 : -4);
  g.fillStyle(0x7b5c46);
  g.fillCircle(hx, hy, 3.6);
  g.fillStyle(0xe0a84a);
  g.fillTriangle(hx + facing * 3, hy - 1, hx + facing * 3, hy + 1, hx + facing * 6, hy + (pecking ? 2 : 0));
  g.fillStyle(0x1f1a17);
  g.fillCircle(hx + facing * 1.2, hy - 1, 0.9);
}

function drawFlyingBird(
  g: Phaser.GameObjects.Graphics, x: number, y: number, height: number, facing: number, timeMs: number, alpha: number
): void {
  const flap = Math.sin(timeMs / 45) * 6;
  const by = y - height;
  g.fillStyle(0x20372f, 0.25 * alpha * (1 - height / 40));
  g.fillEllipse(x, y + 5, 10, 3);
  g.fillStyle(0x6f5442, alpha);
  g.fillTriangle(x - 2, by, x + 2, by, x - 7, by - flap);
  g.fillTriangle(x - 2, by, x + 2, by, x + 7, by - flap);
  g.fillStyle(0x8a6a52, alpha);
  g.fillEllipse(x, by, 10, 6);
  g.fillStyle(0x7b5c46, alpha);
  g.fillCircle(x + facing * 5, by - 1, 3);
}

function drawFox(g: Phaser.GameObjects.Graphics, x: number, y: number, sitting: boolean, facing: number, timeMs: number): void {
  const f = facing;
  g.fillStyle(0x20372f, 0.32);
  g.fillEllipse(x, y + 10, sitting ? 26 : 34, 9);
  if (sitting) {
    // Upright, tail curled round the front paws, ears twitching now and then.
    const twitch = Math.sin(timeMs / 2200) > 0.92 ? 2 : 0;
    g.fillStyle(0xc8662f);
    g.fillEllipse(x - f * 9, y + 6, 20, 9);
    g.fillStyle(0xf3e6d2);
    g.fillEllipse(x - f * 1, y + 7, 7, 5);
    g.fillStyle(0xd9773a);
    g.fillEllipse(x, y - 2, 16, 20);
    g.fillStyle(0xf3e6d2);
    g.fillEllipse(x + f * 2, y + 1, 7, 11);
    g.fillStyle(0x3a2a22);
    g.fillEllipse(x + f * 2, y + 9, 4, 3);
    drawFoxHead(g, x + f * 2, y - 13, f, twitch);
    return;
  }
  const stride = Math.sin(timeMs / 70);
  const bob = Math.abs(stride) * 1.5;
  g.lineStyle(3, 0x3a2a22);
  g.lineBetween(x - f * 7, y + 3, x - f * (7 + stride * 3), y + 9);
  g.lineBetween(x + f * 7, y + 3, x + f * (7 - stride * 3), y + 9);
  g.fillStyle(0xc8662f);
  g.fillEllipse(x - f * 18, y - 2 - bob + stride, 18, 8);
  g.fillStyle(0xf3e6d2);
  g.fillCircle(x - f * 25, y - 2 - bob + stride, 3);
  g.fillStyle(0xd9773a);
  g.fillEllipse(x, y - bob, 24, 12);
  g.fillStyle(0xf3e6d2);
  g.fillEllipse(x + f * 4, y + 3 - bob, 12, 5);
  drawFoxHead(g, x + f * 13, y - 6 - bob, f, 0);
}

function drawFoxHead(g: Phaser.GameObjects.Graphics, x: number, y: number, f: number, twitch: number): void {
  g.fillStyle(0xb85a2a);
  g.fillTriangle(x - 6, y - 2, x - 2, y - 2, x - 5 - twitch, y - 11);
  g.fillTriangle(x + 2, y - 2, x + 6, y - 2, x + 5, y - 11);
  g.fillStyle(0xd9773a);
  g.fillCircle(x, y, 7);
  g.fillStyle(0xf3e6d2);
  g.fillTriangle(x + f * 1, y + 1, x + f * 11, y + 1, x + f * 4, y + 6);
  g.fillStyle(0x2b201b);
  g.fillCircle(x + f * 11, y + 1, 1.6);
  g.fillCircle(x + f * 3, y - 2, 1.2);
}

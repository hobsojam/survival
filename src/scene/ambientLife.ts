import Phaser from 'phaser';
import type { GameState } from '../game/state';
import { worldX, worldY } from './art';
import { LIGHT_DEPTH } from './visuals';
import { sprites } from '../art/sprites';
import {
  BIRD_HOMES, FIREFLY_HOMES, FOX, birdMayReturn, birdShouldLeave, darkness, fireflyGlow, fireflyOffset, foxAt, type Point
} from './ambient';

interface Flight { from: Point; to: Point; elapsed: number; duration: number; leaving: boolean }
interface Bird { home: Point; away: Point | null; flight: Flight | null; restSeconds: number; index: number; image: Phaser.GameObjects.Image }

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const FLIGHT_SECONDS = 1.6;
const FOX_RUN_SECONDS = 2.2;

function sprite(scene: Phaser.Scene, name: string, frame: string, depth = 0): Phaser.GameObjects.Image {
  const def = sprites[name];
  return scene.add.image(0, 0, `${name}:${frame}`)
    .setOrigin(def.anchor[0] / def.size[0], def.anchor[1] / def.size[1])
    .setDepth(depth).setVisible(false);
}

/** Pixel wildlife reads game state but never changes it. */
export class AmbientLife {
  private readonly birds: Bird[];
  private readonly fox: Phaser.GameObjects.Image;
  private readonly fireflies: Phaser.GameObjects.Image[];
  private foxRun: Flight | null = null;
  private foxFledDay = 0;
  private started = false;

  constructor(scene: Phaser.Scene) {
    this.birds = BIRD_HOMES.map((home, index) => ({
      home, away: null, flight: null, restSeconds: 0, index,
      image: sprite(scene, 'bird', 'ground')
    }));
    this.fox = sprite(scene, 'fox', 'standing');
    this.fireflies = FIREFLY_HOMES.map(() => sprite(scene, 'firefly', 'still', LIGHT_DEPTH));
  }

  update(state: GameState, seconds: number, timeMs: number): void {
    const dark = darkness(state.day, state.timeOfDay);
    if (!this.started) {
      this.started = true;
      if (dark > 0.3) for (const bird of this.birds) bird.away = { x: bird.home.x, y: bird.home.y - 9 };
    }
    for (const bird of this.birds) this.updateBird(bird, state.player, dark, seconds, timeMs);
    this.updateFox(state, seconds, timeMs);
    this.updateFireflies(dark, timeMs);
  }

  private show(image: Phaser.GameObjects.Image, x: number, y: number, frame: string, facing = 1, alpha = 1): void {
    image.setTexture(frame).setPosition(Math.round(worldX(x)), Math.round(worldY(y)))
      .setDepth(Math.round(worldY(y))).setFlipX(facing < 0).setAlpha(alpha).setVisible(true);
  }

  private updateBird(bird: Bird, player: Point, dark: number, seconds: number, timeMs: number): void {
    bird.restSeconds = Math.max(0, bird.restSeconds - seconds);
    if (bird.flight) {
      const flight = bird.flight;
      flight.elapsed += seconds;
      const progress = Math.min(1, flight.elapsed / flight.duration);
      const height = (flight.leaving ? progress : 1 - progress) * 2;
      const alpha = flight.leaving ? Math.min(1, (1 - progress) / 0.3) : Math.min(1, progress / 0.3);
      const x = lerp(flight.from.x, flight.to.x, progress);
      const y = lerp(flight.from.y, flight.to.y, progress) - height;
      const facing = Math.sign(flight.to.x - flight.from.x) || 1;
      this.show(bird.image, x, y, 'bird:flying', facing, alpha);
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
      bird.image.setVisible(false);
    } else if (bird.away && bird.restSeconds <= 0 && birdMayReturn(bird.home, player, dark)) {
      bird.flight = { from: bird.away, to: bird.home, elapsed: 0, duration: FLIGHT_SECONDS * 1.4, leaving: false };
    } else if (!bird.away) {
      const hop = (timeMs / 1000 + bird.index * 1.37) % 4 > 3.6 ? 1 : 0;
      this.show(bird.image, bird.home.x, bird.home.y - hop / 16, 'bird:ground', bird.index % 2 ? 1 : -1);
    } else bird.image.setVisible(false);
  }

  private updateFox(state: GameState, seconds: number, timeMs: number): void {
    if (this.foxRun) {
      const run = this.foxRun;
      run.elapsed += seconds;
      const progress = Math.min(1, run.elapsed / run.duration);
      const x = lerp(run.from.x, run.to.x, progress);
      const y = lerp(run.from.y, run.to.y, progress);
      this.show(this.fox, x, y, 'fox:standing', Math.sign(run.to.x - run.from.x) || 1);
      if (progress >= 1) this.foxRun = null;
      return;
    }
    if (this.foxFledDay === state.day) { this.fox.setVisible(false); return; }
    const pose = foxAt(state.day, state.timeOfDay);
    if (!pose) { this.fox.setVisible(false); return; }
    if (Math.hypot(pose.x - state.player.x, pose.y - state.player.y) < FOX.spookRadius) {
      this.foxFledDay = state.day;
      this.foxRun = { from: pose, to: FOX.den, elapsed: 0, duration: FOX_RUN_SECONDS, leaving: true };
      this.fox.setVisible(false);
      return;
    }
    this.show(this.fox, pose.x, pose.y, `fox:${pose.sitting ? 'sitting' : 'standing'}`, pose.facing);
  }

  private updateFireflies(dark: number, timeMs: number): void {
    FIREFLY_HOMES.forEach((home, index) => {
      const image = this.fireflies[index];
      const glow = fireflyGlow(index, timeMs, dark);
      if (glow < 0.02) { image.setVisible(false); return; }
      const offset = fireflyOffset(index, timeMs);
      image.setPosition(Math.round(worldX(home.x + offset.x)), Math.round(worldY(home.y + offset.y)))
        .setAlpha(glow).setVisible(true);
    });
  }
}

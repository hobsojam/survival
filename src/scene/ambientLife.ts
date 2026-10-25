import Phaser from 'phaser';
import type { GameState } from '../game/state';
import { worldX, worldY } from './art';
import { LIGHT_DEPTH } from './visuals';
import { sprites } from '../art/sprites';
import {
  BIRD_HOMES, FIREFLY_HOMES, FOX, birdForageTarget, birdMayReturn, birdShouldLeave, birdGroundFrame, birdFlightFrame,
  darkness, fireflyFrame, fireflyGlow, fireflyOffset, foxAt, foxFrame, type Point
} from './ambient';

type BirdFlightKind = 'flee' | 'return' | 'forage' | 'home';
interface Motion { from: Point; to: Point; elapsed: number; duration: number }
interface Flight extends Motion { kind: BirdFlightKind }
interface Bird {
  home: Point; ground: Point; away: Point | null; flight: Flight | null; restSeconds: number;
  nextForageAtMs: number; forageUntilMs: number; forageNodeId: string | null;
  index: number; image: Phaser.GameObjects.Image;
}

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
/** Fleeing birds climb and fade out, returning ones descend and fade in, short hops arc. */
function flightArc(kind: BirdFlightKind, progress: number): { height: number; alpha: number } {
  if (kind === 'flee') return { height: progress * 2, alpha: Math.min(1, (1 - progress) / 0.3) };
  if (kind === 'return') return { height: (1 - progress) * 2, alpha: Math.min(1, progress / 0.3) };
  return { height: Math.sin(progress * Math.PI) * 1.2, alpha: 1 };
}

function landBird(bird: Bird, flight: Flight, timeMs: number): void {
  bird.flight = null;
  if (flight.kind === 'flee') {
    bird.away = flight.to;
    bird.restSeconds = 8 + bird.index * 2.5;
  } else if (flight.kind === 'forage') {
    bird.ground = flight.to;
    bird.forageUntilMs = timeMs + 3500;
  } else {
    bird.ground = bird.home;
    bird.nextForageAtMs = timeMs + 12000 + bird.index * 1700;
    if (flight.kind === 'return') bird.away = null;
  }
}

export class AmbientLife {
  private readonly birds: Bird[];
  private readonly fox: Phaser.GameObjects.Image;
  private readonly fireflies: Phaser.GameObjects.Image[];
  private foxRun: Motion | null = null;
  private foxFledDay = 0;
  private started = false;

  constructor(scene: Phaser.Scene) {
    this.birds = BIRD_HOMES.map((home, index) => ({
      home, ground: home, away: null, flight: null, restSeconds: 0,
      nextForageAtMs: 0, forageUntilMs: 0, forageNodeId: null, index,
      image: sprite(scene, 'bird', 'idle')
    }));
    this.fox = sprite(scene, 'fox', 'trot0');
    this.fireflies = FIREFLY_HOMES.map(() => sprite(scene, 'firefly', 'glow0', LIGHT_DEPTH));
  }

  update(state: GameState, seconds: number, timeMs: number): void {
    const dark = darkness(state.day, state.timeOfDay);
    if (!this.started) {
      this.started = true;
      for (const bird of this.birds) bird.nextForageAtMs = timeMs + bird.index * 2500;
      if (dark > 0.3) for (const bird of this.birds) bird.away = { x: bird.home.x, y: bird.home.y - 9 };
    }
    for (const bird of this.birds) this.updateBird(bird, state, dark, seconds, timeMs);
    this.updateFox(state, seconds, timeMs);
    this.updateFireflies(dark, timeMs);
  }

  private show(image: Phaser.GameObjects.Image, x: number, y: number, frame: string, facing = 1, alpha = 1): void {
    image.setTexture(frame).setPosition(Math.round(worldX(x)), Math.round(worldY(y)))
      .setDepth(Math.round(worldY(y))).setFlipX(facing < 0).setAlpha(alpha).setVisible(true);
  }

  private startBirdFlee(bird: Bird, from: Point, player: Point, dark: number): void {
    const angle = dark > 0.3
      ? -Math.PI / 2 + (bird.index - 2) * 0.5
      : Math.atan2(from.y - player.y, from.x - player.x) + (bird.index - 2) * 0.25;
    const to = { x: from.x + Math.cos(angle) * 9, y: from.y + Math.sin(angle) * 9 };
    bird.flight = { from, to, elapsed: 0, duration: FLIGHT_SECONDS, kind: 'flee' };
    bird.forageUntilMs = 0;
    bird.forageNodeId = null;
    bird.image.setVisible(false);
  }

  private updateBird(bird: Bird, state: GameState, dark: number, seconds: number, timeMs: number): void {
    const player = state.player;
    bird.restSeconds = Math.max(0, bird.restSeconds - seconds);
    if (bird.flight) this.updateFlight(bird, bird.flight, player, dark, seconds, timeMs);
    else if (!bird.away && birdShouldLeave(bird.ground, player, dark)) this.startBirdFlee(bird, bird.ground, player, dark);
    else if (bird.away && bird.restSeconds <= 0 && birdMayReturn(bird.home, player, dark)) {
      bird.flight = { from: bird.away, to: bird.home, elapsed: 0, duration: FLIGHT_SECONDS * 1.4, kind: 'return' };
    } else if (!bird.away) this.updateGroundedBird(bird, state, timeMs);
    else bird.image.setVisible(false);
  }

  private updateFlight(bird: Bird, flight: Flight, player: Point, dark: number, seconds: number, timeMs: number): void {
    if (flight.kind === 'forage' || flight.kind === 'home') {
      const progress = Math.min(1, flight.elapsed / flight.duration);
      const position = { x: lerp(flight.from.x, flight.to.x, progress), y: lerp(flight.from.y, flight.to.y, progress) };
      if (birdShouldLeave(position, player, dark)) {
        this.startBirdFlee(bird, position, player, dark);
        return;
      }
    }
    flight.elapsed += seconds;
    const progress = Math.min(1, flight.elapsed / flight.duration);
    const { height, alpha } = flightArc(flight.kind, progress);
    const x = lerp(flight.from.x, flight.to.x, progress);
    const y = lerp(flight.from.y, flight.to.y, progress) - height;
    const facing = Math.sign(flight.to.x - flight.from.x) || 1;
    this.show(bird.image, x, y, birdFlightFrame(flight.elapsed), facing, alpha);
    if (progress >= 1) landBird(bird, flight, timeMs);
  }

  /** A bird on the ground pecks at a bush, sets off to forage, or hops about at home. */
  private updateGroundedBird(bird: Bird, state: GameState, timeMs: number): void {
    if (bird.forageUntilMs > 0) {
      const bushReady = state.nodes.some(node => node.id === bird.forageNodeId && node.amount > 0);
      if (timeMs >= bird.forageUntilMs || !bushReady) {
        bird.forageUntilMs = 0;
        bird.forageNodeId = null;
        bird.flight = { from: bird.ground, to: bird.home, elapsed: 0, duration: FLIGHT_SECONDS, kind: 'home' };
        return;
      }
      this.show(bird.image, bird.ground.x, bird.ground.y, `bird:peck${Math.floor(timeMs / 170) % 2}`);
      return;
    }
    if (timeMs >= bird.nextForageAtMs) {
      const target = birdForageTarget(bird.home, state.nodes, Math.random());
      bird.nextForageAtMs = timeMs + 12000 + bird.index * 1700;
      if (target) {
        bird.forageNodeId = target.id;
        bird.flight = {
          from: bird.ground, to: { x: target.x + 0.35, y: target.y + 0.65 },
          elapsed: 0, duration: FLIGHT_SECONDS, kind: 'forage'
        };
        return;
      }
    }
    const frame = birdGroundFrame(bird.index, timeMs);
    const hop = frame === 'bird:hop' ? 1 : 0;
    this.show(bird.image, bird.ground.x, bird.ground.y - hop / 16, frame, bird.index % 2 ? 1 : -1);
  }

  private updateFox(state: GameState, seconds: number, timeMs: number): void {
    if (this.foxRun) {
      const run = this.foxRun;
      run.elapsed += seconds;
      const progress = Math.min(1, run.elapsed / run.duration);
      const x = lerp(run.from.x, run.to.x, progress);
      const y = lerp(run.from.y, run.to.y, progress);
      this.show(this.fox, x, y, foxFrame('run', run.elapsed), Math.sign(run.to.x - run.from.x) || 1);
      if (progress >= 1) this.foxRun = null;
      return;
    }
    if (this.foxFledDay === state.day) { this.fox.setVisible(false); return; }
    const pose = foxAt(state.day, state.timeOfDay);
    if (!pose) { this.fox.setVisible(false); return; }
    if (Math.hypot(pose.x - state.player.x, pose.y - state.player.y) < FOX.spookRadius) {
      this.foxFledDay = state.day;
      this.foxRun = { from: pose, to: FOX.den, elapsed: 0, duration: FOX_RUN_SECONDS };
      this.fox.setVisible(false);
      return;
    }
    const foxPose = pose.sitting ? 'sit' : 'trot';
    this.show(this.fox, pose.x, pose.y, foxFrame(foxPose, timeMs / 1000), pose.facing);
  }

  private updateFireflies(dark: number, timeMs: number): void {
    FIREFLY_HOMES.forEach((home, index) => {
      const image = this.fireflies[index];
      const glow = fireflyGlow(index, timeMs, dark);
      if (glow < 0.02) { image.setVisible(false); return; }
      const offset = fireflyOffset(index, timeMs);
      image.setTexture(fireflyFrame(index, timeMs));
      image.setPosition(Math.round(worldX(home.x + offset.x)), Math.round(worldY(home.y + offset.y)))
        .setAlpha(glow).setVisible(true);
    });
  }
}

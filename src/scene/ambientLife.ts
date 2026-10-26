import Phaser from 'phaser';
import type { GameState } from '../game/state';
import { worldX, worldY } from './art';
import { LIGHT_DEPTH } from './visuals';
import { sprites } from '../art/sprites';
import { firefliesOut, isWinter, leavesFalling } from '../game/calendar';
import { wolvesClose } from '../game/wolves';
import {
  BIRD_HOMES, EYE_SPOTS, FIREFLY_HOMES, FOX, birdForageTarget, birdMayReturn, birdShouldLeave, birdGroundFrame, birdFlightFrame,
  LEAF_HOMES, WOLF_SPOTS, darkness, eyesAt, fireflyFrame, fireflyGlow, fireflyOffset, foxAt, foxFrame, leafAt, wolfCount, wolfWatch, type Point
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
  private readonly leaves: Phaser.GameObjects.Image[];
  private readonly eyes: Phaser.GameObjects.Image[];
  private readonly wolfEyes: Phaser.GameObjects.Image[];
  /** Eases toward how strongly the wolves press in, so their eyes fade rather than blink out. */
  private wolfPresence = 0;
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
    this.leaves = LEAF_HOMES.map(() => sprite(scene, 'leaf', 'fall0'));
    this.eyes = EYE_SPOTS.map(() => sprite(scene, 'eyes', 'open', LIGHT_DEPTH));
    this.wolfEyes = WOLF_SPOTS.map(() => sprite(scene, 'eyes', 'open', LIGHT_DEPTH));
  }

  update(state: GameState, seconds: number, timeMs: number): void {
    const dark = darkness(state.day, state.timeOfDay);
    // The birds, the fox and the fireflies live at camp; the eyes watch the quarry.
    if (state.area === 'quarry') this.updateEyes(dark, state, timeMs);
    else for (const image of this.eyes) image.setVisible(false);
    this.updateWolves(state, dark, seconds, timeMs);
    if (state.area !== 'camp') {
      for (const image of [...this.birds.map(bird => bird.image), this.fox, ...this.fireflies, ...this.leaves]) image.setVisible(false);
      return;
    }
    if (!this.started) this.start(dark, timeMs);
    // The birds leave for the winter.
    if (isWinter(state.day)) for (const bird of this.birds) bird.image.setVisible(false);
    else for (const bird of this.birds) this.updateBird(bird, state, dark, seconds, timeMs);
    this.updateFox(state, seconds, timeMs);
    // Fireflies are a summer-night sight, and leaves fall on autumn days.
    this.updateFireflies(firefliesOut(state.day) ? dark : 0, timeMs);
    this.updateLeaves(state, dark, timeMs);
  }

  /** Staggers the birds' first forage, and sends them away if camp opens after dark. */
  private start(dark: number, timeMs: number): void {
    this.started = true;
    for (const bird of this.birds) bird.nextForageAtMs = timeMs + bird.index * 2500;
    if (dark > 0.3) for (const bird of this.birds) bird.away = { x: bird.home.x, y: bird.home.y - 9 };
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

  private updateEyes(dark: number, state: GameState, timeMs: number): void {
    this.eyes.forEach((image, index) => {
      const eyes = eyesAt(index, timeMs, dark, state.player);
      if (!eyes) { image.setVisible(false); return; }
      image.setTexture(`eyes:${eyes.frame}`).setPosition(Math.round(worldX(eyes.x)), Math.round(worldY(eyes.y)))
        .setAlpha(eyes.alpha).setVisible(true);
    });
  }

  /** Wolf eyes at the camp edge on winter nights while the fire burns low, fading as it is fed. */
  private updateWolves(state: GameState, dark: number, seconds: number, timeMs: number): void {
    const target = state.area === 'camp' && wolvesClose(state) ? wolfWatch(state.fireFuel) : 0;
    this.wolfPresence += Math.max(-seconds, Math.min(seconds, target - this.wolfPresence));
    const count = wolfCount(state.day);
    this.wolfEyes.forEach((image, index) => {
      const eyes = index < count && state.area === 'camp' ? eyesAt(index, timeMs, dark, state.player, WOLF_SPOTS) : null;
      const alpha = (eyes?.alpha ?? 0) * this.wolfPresence;
      if (!eyes || alpha < 0.02) { image.setVisible(false); return; }
      image.setTexture(`eyes:${eyes.frame}`).setPosition(Math.round(worldX(eyes.x)), Math.round(worldY(eyes.y)))
        .setAlpha(alpha).setVisible(true);
    });
  }

  private updateLeaves(state: GameState, dark: number, timeMs: number): void {
    const falling = leavesFalling(state.day) && dark < 0.3;
    LEAF_HOMES.forEach((home, index) => {
      const image = this.leaves[index];
      const tree = state.trees.find(each => each.id === home.treeId);
      const leaf = falling && tree && tree.readyDay <= state.day ? leafAt(index, timeMs) : null;
      if (!leaf) { image.setVisible(false); return; }
      this.show(image, leaf.x, leaf.y, leaf.frame, 1, leaf.alpha);
      // Drawn in front of the crown it falls from.
      image.setDepth(Math.round(worldY(home.y + 2)));
    });
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

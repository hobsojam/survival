import Phaser from 'phaser';
import { season, type Season } from '../game/calendar';
import type { GameState } from '../game/state';
import { PICTURE_HEIGHT, PICTURE_WIDTH, movingRects, pictureFit, stillRects, viewLine, type PictureRect } from './keepViewArt';
import { campView, type CampView } from './keepViewCamp';
import { WEATHER_DEPTH } from './visuals';

// The view from the top of the keep on screen. What it shows is decided in keepViewArt and keepViewCamp; this only paints it.

const TEXTURE = 'keepView';
const TICK_MS = 125;
const LINE_MARGIN = 6;

interface Showing {
  season: Season;
  camp: CampView;
  still: HTMLCanvasElement;
  texture: Phaser.Textures.CanvasTexture;
  image: Phaser.GameObjects.Image;
  line: Phaser.GameObjects.Text;
  tick: number;
}

function paint(context: CanvasRenderingContext2D, rects: readonly PictureRect[]): void {
  for (const rect of rects) {
    context.fillStyle = rect.color;
    context.fillRect(rect.x, rect.y, rect.w, rect.h);
  }
}

export class KeepViewLayer {
  private showing: Showing | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  show(state: GameState, width: number, height: number): void {
    this.hide();
    const now = season(state.day);
    const camp = campView(state);
    const still = document.createElement('canvas');
    still.width = PICTURE_WIDTH;
    still.height = PICTURE_HEIGHT;
    paint(still.getContext('2d')!, stillRects(now, camp));
    const texture = this.scene.textures.createCanvas(TEXTURE, PICTURE_WIDTH, PICTURE_HEIGHT)!;
    const image = this.scene.add.image(0, 0, TEXTURE).setOrigin(0).setScrollFactor(0).setDepth(WEATHER_DEPTH + 1);
    const line = this.scene.add.text(0, 0, viewLine(now), { fontFamily: 'Georgia, serif', fontSize: '11px', color: '#fbf4df', align: 'center' })
      .setOrigin(0.5, 1).setScrollFactor(0).setDepth(WEATHER_DEPTH + 1).setShadow(0, 1, '#000000', 3, false, true).setResolution(4);
    this.showing = { season: now, camp, still, texture, image, line, tick: -1 };
    this.resize(width, height);
    this.update(0);
  }

  hide(): void {
    if (!this.showing) return;
    this.showing.image.destroy();
    this.showing.line.destroy();
    this.scene.textures.remove(TEXTURE);
    this.showing = null;
  }

  resize(width: number, height: number): void {
    if (!this.showing) return;
    const fit = pictureFit(width, height);
    this.showing.image.setPosition(fit.x, fit.y).setScale(fit.scale);
    this.showing.line.setPosition(width / 2, height - LINE_MARGIN).setWordWrapWidth(width - LINE_MARGIN * 2);
  }

  /** Repaints only when the small, slow movement has moved on. */
  update(nowMs: number): void {
    const showing = this.showing;
    if (!showing) return;
    const tick = Math.floor(nowMs / TICK_MS);
    if (tick === showing.tick) return;
    showing.tick = tick;
    const context = showing.texture.getContext();
    context.drawImage(showing.still, 0, 0);
    paint(context, movingRects(showing.season, showing.camp, tick));
    showing.texture.refresh();
  }
}

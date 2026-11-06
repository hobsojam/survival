import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createGame } from '../src/game/state';
import { KeepViewLayer } from '../src/scene/KeepViewLayer';
import { pictureFit, viewLine } from '../src/scene/keepViewArt';

const fakeContext = () => ({ fillStyle: '', drawn: 0, filled: 0, drawImage() { this.drawn += 1; }, fillRect() { this.filled += 1; } });

/** Stands in for a Phaser game object, whose setters return itself, remembering each last call. */
function gameObject(text?: string) {
  const called: Record<string, unknown[]> = {};
  let destroyed = 0;
  const self: Record<string, unknown> = new Proxy({}, {
    get(_target, key: string) {
      if (key === 'called') return called;
      if (key === 'text') return text;
      if (key === 'destroyed') return destroyed;
      if (key === 'destroy') return () => { destroyed += 1; };
      return (...args: unknown[]) => { called[key] = args; return self; };
    }
  });
  return self as { called: Record<string, unknown[]>; text?: string; destroyed: number };
}

function fakeScene() {
  const images: ReturnType<typeof gameObject>[] = [];
  const lines: ReturnType<typeof gameObject>[] = [];
  const textures: { key: string; context: ReturnType<typeof fakeContext>; refreshed: number }[] = [];
  const removed: string[] = [];
  const scene = {
    textures: {
      createCanvas: (key: string) => {
        const texture = { key, context: fakeContext(), refreshed: 0, getContext() { return this.context; }, refresh() { this.refreshed += 1; } };
        textures.push(texture);
        return texture;
      },
      remove: (key: string) => { removed.push(key); }
    },
    add: {
      image: () => { const image = gameObject(); images.push(image); return image; },
      text: (_x: number, _y: number, text: string) => { const line = gameObject(text); lines.push(line); return line; }
    }
  };
  return { layer: new KeepViewLayer(scene as never), images, lines, textures, removed };
}

beforeEach(() => {
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: fakeContext }) });
});
afterEach(() => vi.unstubAllGlobals());

const autumn = createGame();

it('paints the picture and the season\'s line, fitted to the frame', () => {
  const { layer, images, lines, textures } = fakeScene();
  layer.show(autumn, 480, 300);
  const fit = pictureFit(480, 300);
  expect(images[0].called.setPosition).toEqual([fit.x, fit.y]);
  expect(images[0].called.setScale).toEqual([fit.scale]);
  expect(lines[0].text).toBe(viewLine('autumn'));
  expect(lines[0].called.setPosition).toEqual([240, 294]);
  expect(textures[0].context.drawn).toBe(1);
  expect(textures[0].context.filled).toBeGreaterThan(0);
  expect(textures[0].refreshed).toBe(1);
});

it('repaints only when the movement has moved on', () => {
  const { layer, textures } = fakeScene();
  layer.show(autumn, 480, 300);
  layer.update(100);
  expect(textures[0].refreshed).toBe(1);
  layer.update(125);
  expect(textures[0].refreshed).toBe(2);
  layer.update(249);
  expect(textures[0].refreshed).toBe(2);
});

it('refits when the frame changes', () => {
  const { layer, images } = fakeScene();
  layer.show(autumn, 480, 300);
  layer.resize(195, 339);
  const fit = pictureFit(195, 339);
  expect(images[0].called.setPosition).toEqual([fit.x, fit.y]);
  expect(images[0].called.setScale).toEqual([fit.scale]);
});

it('cleans up after itself, so it can be climbed again and again', () => {
  const { layer, images, lines, textures, removed } = fakeScene();
  layer.show(autumn, 480, 300);
  layer.hide();
  expect([images[0].destroyed, lines[0].destroyed]).toEqual([1, 1]);
  expect(removed).toEqual(['keepView']);
  layer.show(autumn, 480, 300);
  expect(textures).toHaveLength(2);
  layer.show(autumn, 480, 300);
  expect(images[1].destroyed).toBe(1);
  expect(removed).toHaveLength(2);
});

it('does nothing when it is not showing', () => {
  const { layer, images, removed } = fakeScene();
  layer.resize(100, 100);
  layer.update(100);
  layer.hide();
  expect(images).toEqual([]);
  expect(removed).toEqual([]);
});

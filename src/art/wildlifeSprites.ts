import type { PaletteKey } from './palette';
import type { SpriteDef } from './sprites';

type Grid = string[][];
const blank = (width: number, height: number): Grid => Array.from({ length: height }, () => Array.from({ length: width }, () => '.'));
const dot = (g: Grid, x: number, y: number, color: string): void => { if (g[y]?.[x] !== undefined) g[y][x] = color; };
const box = (g: Grid, x: number, y: number, width: number, height: number, color: string): void => {
  for (let yy = y; yy < y + height; yy++) for (let xx = x; xx < x + width; xx++) dot(g, xx, yy, color);
};
const line = (g: Grid, x0: number, y0: number, x1: number, y1: number, color: string): void => {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let step = 0; step <= steps; step++) dot(g, Math.round(x0 + (x1 - x0) * step / steps), Math.round(y0 + (y1 - y0) * step / steps), color);
};
function define(width: number, height: number, legend: Record<string, PaletteKey>, painters: Record<string, (g: Grid) => void>, anchor: [number, number], animations?: SpriteDef['animations']): SpriteDef {
  const frames: Record<string, string[]> = {};
  for (const [name, paint] of Object.entries(painters)) {
    const g = blank(width, height);
    paint(g);
    frames[name] = g.map(row => row.join(''));
  }
  return { size: [width, height], anchor, legend, frames, animations };
}

const birdLegend = { a: 'bird0', b: 'bird1', c: 'bird2', d: 'bird3', e: 'bird4', f: 'beak', s: 'shadow' } as const;
function bird(g: Grid, pose: 'idle' | 'peck0' | 'peck1' | 'hop' | 'fly0' | 'fly1'): void {
  if (pose === 'fly0' || pose === 'fly1') {
    const wingY = pose === 'fly0' ? 0 : 5;
    line(g, 1, wingY, 3, 3, 'c'); line(g, 3, 3, 5, wingY, 'd');
    box(g, 2, 3, 4, 2, 'b'); box(g, 4, 3, 2, 2, 'd');
    dot(g, 5, 3, 'a'); dot(g, 6, 4, 'f'); dot(g, 1, 4, 'e');
    return;
  }
  box(g, 1, 7, 6, 1, 's');
  let bodyY = pose === 'hop' ? 2 : 3;
  if (pose === 'peck1') bodyY = 4;
  box(g, 1, bodyY, 5, 3, 'b'); box(g, 2, bodyY, 3, 2, 'c');
  box(g, 3, bodyY + 1, 2, 1, 'd'); dot(g, 1, bodyY + 1, 'e');
  if (pose === 'peck0' || pose === 'peck1') {
    box(g, 5, bodyY + 1, 2, 2, 'd'); dot(g, 6, bodyY + 1, 'a');
    dot(g, 7, bodyY + 3, 'f');
  } else {
    box(g, 5, bodyY - 1, 2, 2, 'd'); dot(g, 6, bodyY - 1, 'a');
    dot(g, 7, bodyY, 'f');
  }
  if (pose !== 'hop') { dot(g, 3, 6, 'a'); dot(g, 5, 6, 'a'); }
  else { dot(g, 2, 5, 'a'); dot(g, 5, 5, 'a'); }
}

const foxLegend = { a: 'fox0', b: 'fox1', c: 'fox2', d: 'fox3', e: 'fox4', s: 'shadow' } as const;
function fox(g: Grid, pose: 'trot' | 'run' | 'sit', frame: number): void {
  if (pose === 'sit') {
    box(g, 6, 15, 12, 1, 's');
    box(g, 6, 10 + frame, 6, 4, 'b'); box(g, 7, 10 + frame, 4, 2, 'c');
    box(g, 9, 7, 7, 8, 'b'); box(g, 10, 7, 6, 7, 'c');
    box(g, 11, 8, 4, 4, 'd'); box(g, 12, 11, 3, 3, 'e');
    box(g, 10, 2, 7, 7, 'c'); box(g, 11, 3, 6, 5, 'd');
    box(g, 11, 0, 2, 4, 'b'); box(g, 15, 0, 2, 4, 'b');
    dot(g, 11, 0, 'd'); dot(g, 15, 0, 'd');
    box(g, 16, 6, 2, 2, 'e'); dot(g, 17, 5, 'a'); dot(g, 16, 4, 'a');
    dot(g, 18, 7, 'a');
    return;
  }
  box(g, 2, 14, 19, 1, 's');
  const stretch = pose === 'run' ? 1 : 0;
  const tailY = 7 + (frame % 2);
  box(g, 1, tailY, 6, 3, 'b'); box(g, 1, tailY, 3, 2, 'e');
  box(g, 5, 6 + stretch, 12, 6, 'b'); box(g, 6, 6 + stretch, 11, 4, 'c');
  box(g, 8, 6 + stretch, 8, 2, 'd'); box(g, 9, 10 + stretch, 5, 2, 'e');
  const frontLeg = frame % 2 === 0 ? 1 : -1;
  const backLeg = frame < 2 ? -1 : 1;
  box(g, 6 + backLeg, 11, 2, 4, 'b'); box(g, 15 + frontLeg, 11, 2, 4, 'b');
  if (pose === 'run') { dot(g, 7 - backLeg, 13, 'd'); dot(g, 16 - frontLeg, 13, 'd'); }
  else { dot(g, 6 + backLeg, 14, 'a'); dot(g, 15 + frontLeg, 14, 'a'); }
  box(g, 15, 3, 6, 5, 'c'); box(g, 16, 3, 5, 3, 'd');
  box(g, 16, 1, 2, 3, 'b'); box(g, 20, 1, 2, 3, 'b');
  dot(g, 20, 5, 'a'); box(g, 20, 7, 3, 2, 'e'); dot(g, 23, 7, 'a');
}

const painters: Record<string, (g: Grid) => void> = {};
for (const pose of ['idle', 'peck0', 'peck1', 'hop', 'fly0', 'fly1'] as const) painters[pose] = g => bird(g, pose);
const birdSprite = define(8, 8, birdLegend, painters, [4, 7], {
  peck: { frames: ['peck0', 'peck1'], frameRate: 4, repeat: 0 },
  fly: { frames: ['fly0', 'fly1'], frameRate: 12, repeat: -1 }
});
const foxPainters: Record<string, (g: Grid) => void> = {};
for (const pose of ['trot', 'run'] as const) for (let frame = 0; frame < 4; frame++)
  foxPainters[`${pose}${frame}`] = g => fox(g, pose, frame);
for (let frame = 0; frame < 2; frame++) foxPainters[`sit${frame}`] = g => fox(g, 'sit', frame);
const foxSprite = define(24, 16, foxLegend, foxPainters, [12, 15], {
  trot: { frames: ['trot0', 'trot1', 'trot2', 'trot3'], frameRate: 10, repeat: -1 },
  run: { frames: ['run0', 'run1', 'run2', 'run3'], frameRate: 14, repeat: -1 },
  sit: { frames: ['sit0', 'sit1'], frameRate: 2, repeat: -1 }
});

/** A young grey wolf, a little leggier than the fox: walking, sitting up, and stretched out by the fire. */
const wolfLegend = { a: 'stone0', b: 'stone1', c: 'stone2', d: 'stone3', e: 'stone4', s: 'shadow' } as const;
function wolf(g: Grid, pose: 'walk0' | 'walk1' | 'sit' | 'lie' | 'howl'): void {
  if (pose === 'howl') {
    // Lying as by the fire, with its head lifted and its muzzle to the sky.
    box(g, 2, 15, 20, 1, 's');
    box(g, 1, 12, 6, 2, 'b'); box(g, 1, 12, 3, 1, 'd');
    box(g, 5, 10, 13, 5, 'b'); box(g, 6, 10, 11, 3, 'c'); box(g, 8, 10, 7, 1, 'd');
    box(g, 16, 6, 4, 5, 'b'); box(g, 17, 6, 3, 4, 'c');
    box(g, 16, 2, 5, 5, 'c'); box(g, 17, 3, 3, 3, 'd');
    box(g, 16, 0, 2, 3, 'b');
    line(g, 20, 3, 23, 0, 'e'); dot(g, 23, 0, 'a'); dot(g, 19, 3, 'a');
    return;
  }
  if (pose === 'lie') {
    box(g, 2, 15, 20, 1, 's');
    box(g, 1, 12, 6, 2, 'b'); box(g, 1, 12, 3, 1, 'd');
    box(g, 5, 10, 13, 5, 'b'); box(g, 6, 10, 11, 3, 'c'); box(g, 8, 10, 7, 1, 'd');
    box(g, 17, 9, 6, 5, 'c'); box(g, 18, 9, 4, 3, 'd');
    box(g, 18, 7, 2, 3, 'b'); box(g, 21, 7, 2, 3, 'b');
    dot(g, 21, 11, 'a'); box(g, 20, 13, 4, 1, 'e'); dot(g, 23, 12, 'a');
    return;
  }
  if (pose === 'sit') {
    box(g, 6, 15, 12, 1, 's');
    box(g, 5, 12, 5, 3, 'b'); box(g, 5, 12, 2, 1, 'd');
    box(g, 8, 6, 7, 9, 'b'); box(g, 9, 6, 6, 7, 'c');
    box(g, 11, 8, 3, 6, 'e'); box(g, 13, 13, 2, 2, 'b');
    box(g, 10, 1, 7, 6, 'c'); box(g, 11, 2, 6, 4, 'd');
    box(g, 10, 0, 2, 2, 'b'); box(g, 15, 0, 2, 2, 'b');
    dot(g, 15, 3, 'a'); box(g, 16, 5, 3, 2, 'e'); dot(g, 18, 5, 'a');
    return;
  }
  const frame = pose === 'walk0' ? 0 : 1;
  box(g, 2, 15, 19, 1, 's');
  box(g, 0, 6 + frame, 5, 2, 'b'); box(g, 0, 6 + frame, 2, 1, 'd');
  box(g, 4, 5, 13, 6, 'b'); box(g, 5, 5, 12, 4, 'c'); box(g, 7, 5, 8, 1, 'd'); box(g, 8, 9, 6, 2, 'e');
  const swing = frame ? 1 : -1;
  box(g, 5 + swing, 10, 2, 5, 'b'); box(g, 14 - swing, 10, 2, 5, 'b');
  dot(g, 5 + swing, 14, 'a'); dot(g, 14 - swing, 14, 'a');
  box(g, 15, 2, 6, 5, 'c'); box(g, 16, 2, 5, 3, 'd');
  box(g, 16, 0, 2, 3, 'b'); box(g, 19, 0, 2, 3, 'b');
  dot(g, 19, 4, 'a'); box(g, 20, 6, 3, 2, 'e'); dot(g, 23, 6, 'a');
}
const wolfSprite = define(24, 16, wolfLegend, {
  walk0: g => wolf(g, 'walk0'), walk1: g => wolf(g, 'walk1'), sit: g => wolf(g, 'sit'), lie: g => wolf(g, 'lie'), howl: g => wolf(g, 'howl')
}, [12, 15]);

/** A friend's shed feather or tuft of fur, lying by the fire. */
const keepsakeSprite = define(5, 3, { a: 'bird2', b: 'bird4', c: 'stone3', d: 'fox3' }, {
  feather: g => { line(g, 0, 2, 4, 0, 'a'); dot(g, 1, 1, 'b'); dot(g, 2, 0, 'b'); dot(g, 3, 1, 'b'); },
  fur: g => { box(g, 1, 1, 3, 2, 'c'); dot(g, 0, 2, 'c'); dot(g, 2, 0, 'd'); dot(g, 4, 2, 'd'); }
}, [2, 2]);

const fireflySprite = define(3, 3, { a: 'fire4', b: 'firefly' }, {
  glow0: g => { dot(g, 1, 1, 'b'); dot(g, 0, 1, 'a'); dot(g, 2, 1, 'a'); },
  glow1: g => { dot(g, 1, 1, 'b'); dot(g, 1, 0, 'a'); dot(g, 1, 2, 'a'); dot(g, 0, 1, 'a'); dot(g, 2, 1, 'a'); }
}, [1, 1], { glow: { frames: ['glow0', 'glow1'], frameRate: 2, repeat: -1 } });

const leafSprite = define(3, 3, { a: 'crown2', b: 'crown3', c: 'crown4' }, {
  fall0: g => { dot(g, 0, 0, 'b'); dot(g, 1, 1, 'c'); dot(g, 2, 2, 'a'); },
  fall1: g => { dot(g, 0, 1, 'a'); dot(g, 1, 1, 'b'); dot(g, 2, 1, 'c'); }
}, [1, 1]);

const eyesSprite = define(7, 3, { a: 'fire4', b: 'firefly' }, {
  open: g => { box(g, 0, 1, 2, 1, 'b'); box(g, 5, 1, 2, 1, 'b'); dot(g, 0, 0, 'a'); dot(g, 5, 0, 'a'); dot(g, 1, 2, 'a'); dot(g, 6, 2, 'a'); },
  blink: g => { box(g, 0, 1, 2, 1, 'a'); box(g, 5, 1, 2, 1, 'a'); }
}, [3, 1]);

/** Paw prints in a loose ring around the fire pit, left by a wolf that came into the dark camp. */
const wolfTracksSprite = define(40, 24, { k: 'stone1', l: 'stone2' }, {
  still: g => {
    for (const [x, y] of [[4, 11], [8, 5], [15, 2], [23, 2], [31, 5], [35, 11], [33, 17], [26, 21], [14, 21], [6, 17]]) {
      box(g, x, y, 2, 2, 'k'); dot(g, x, y, 'l');
    }
  }
}, [20, 12]);

const gatherLegend = { a: 'wood1', b: 'wood3', c: 'berry2', d: 'berry4', e: 'canvas2', f: 'canvas4', g: 'stone1', h: 'stone3' } as const;
const gatherPop = define(8, 8, gatherLegend, {
  wood: g => { line(g, 1, 6, 6, 2, 'a'); line(g, 1, 5, 6, 1, 'b'); dot(g, 1, 5, 'f'); },
  berry: g => { box(g, 2, 2, 4, 4, 'c'); box(g, 3, 2, 2, 2, 'd'); dot(g, 2, 3, 'd'); dot(g, 4, 1, 'e'); },
  fiber: g => { box(g, 2, 2, 4, 5, 'e'); box(g, 3, 1, 2, 5, 'f'); line(g, 2, 5, 5, 2, 'a'); },
  stone: g => { box(g, 1, 4, 6, 3, 'g'); box(g, 2, 2, 4, 3, 'h'); dot(g, 2, 2, 'f'); }
}, [4, 7]);
const smokePuff = define(8, 8, { a: 'stone3', b: 'stone4' }, {
  puff0: g => { box(g, 3, 4, 3, 3, 'a'); box(g, 4, 3, 2, 2, 'b'); },
  puff1: g => { box(g, 2, 3, 4, 3, 'a'); box(g, 3, 2, 2, 2, 'b'); dot(g, 6, 3, 'b'); },
  puff2: g => { box(g, 1, 2, 5, 3, 'a'); box(g, 2, 1, 3, 2, 'b'); dot(g, 6, 2, 'b'); }
}, [4, 7], { puff: { frames: ['puff0', 'puff1', 'puff2'], frameRate: 5, repeat: 0 } });
const spark = define(1, 1, { a: 'fire4' }, { still: g => dot(g, 0, 0, 'a') }, [0, 0]);
const windStreak = define(12, 3, { a: 'frost' }, {
  streak0: g => { line(g, 0, 2, 7, 1, 'a'); box(g, 7, 1, 3, 1, 'a'); },
  streak1: g => { line(g, 1, 2, 8, 0, 'a'); box(g, 8, 0, 4, 1, 'a'); },
  streak2: g => { line(g, 2, 2, 8, 1, 'a'); box(g, 8, 1, 2, 1, 'a'); }
}, [6, 1], { drift: { frames: ['streak0', 'streak1', 'streak2'], frameRate: 8, repeat: -1 } });
/** A spring rabbit side-on, facing right: brown body, a pale belly, a white tail and one long ear. */
const rabbitLegend = { a: 'bird0', b: 'bird1', c: 'bird2', d: 'bird3', e: 'bird4', w: 'paper', k: 'ink' } as const;
function rabbit(g: Grid, pose: 'sit' | 'nibble0' | 'nibble1' | 'hop0' | 'hop1'): void {
  const lift = pose === 'hop1' ? 1 : 0;
  const low = pose === 'hop0' ? 1 : 0;
  const headY = pose.startsWith('nibble') ? 4 : 2 + low - lift;
  box(g, 1, 4 + low - lift, 6, 3 - low, 'c'); box(g, 2, 3 + low - lift, 4, 1, 'd');
  box(g, 2, 6 - lift, 4, 1, 'e');
  box(g, 6, headY, 3, 3, 'c'); dot(g, 8, headY + 1, 'k'); dot(g, 9, headY + 2, pose === 'nibble1' ? 'e' : 'd');
  line(g, 6, headY - 1, 6, Math.max(0, headY - 2), 'b'); dot(g, 7, Math.max(0, headY - 2), 'a');
  dot(g, 0, 4 + low - lift, 'w'); dot(g, 1, 4 + low - lift, 'w');
  if (pose === 'hop1') { line(g, 0, 6, 1, 7, 'b'); dot(g, 7, 6, 'b'); }
  else { box(g, 1, 7, 2, 1, 'b'); box(g, 5, 7, 2, 1, 'b'); }
}
const rabbitSprite = define(10, 8, rabbitLegend, {
  sit: g => rabbit(g, 'sit'), nibble0: g => rabbit(g, 'nibble0'), nibble1: g => rabbit(g, 'nibble1'),
  hop0: g => rabbit(g, 'hop0'), hop1: g => rabbit(g, 'hop1')
}, [5, 7]);

/** A falling raindrop, leaning slightly with the wind. */
const rainStreak = define(3, 6, { a: 'frost', b: 'flower4' }, {
  still: g => { dot(g, 2, 0, 'b'); dot(g, 2, 1, 'a'); dot(g, 1, 2, 'a'); dot(g, 1, 3, 'a'); dot(g, 0, 4, 'b'); dot(g, 0, 5, 'b'); }
}, [0, 0]);

/** A shallow puddle left by a spring shower: a dark rim, the sky in it, one glint. */
const puddle = define(16, 6, { r: 'earth1', w: 'flower4', g: 'frost' }, {
  still: g => {
    box(g, 2, 0, 12, 6, 'r'); box(g, 0, 1, 16, 4, 'r');
    box(g, 3, 1, 10, 4, 'w'); box(g, 1, 2, 14, 2, 'w');
    box(g, 5, 2, 3, 1, 'g');
  }
}, [8, 3]);

/** A snowflake blowing in the cold night's wind: a bright core with a softer edge, big or small. */
const snowFlake = define(3, 3, { a: 'frost', b: 'flower4' }, {
  big: g => { box(g, 0, 1, 3, 1, 'b'); box(g, 1, 0, 1, 3, 'b'); dot(g, 1, 1, 'a'); },
  small: g => { box(g, 1, 1, 2, 1, 'a'); dot(g, 1, 2, 'b'); }
}, [1, 1]);
const cookSteam = define(4, 6, { a: 'stone3', b: 'stone4' }, {
  steam0: g => { dot(g, 1, 5, 'a'); dot(g, 2, 4, 'b'); dot(g, 1, 3, 'a'); },
  steam1: g => { dot(g, 2, 5, 'a'); dot(g, 1, 3, 'b'); dot(g, 2, 2, 'a'); dot(g, 2, 1, 'b'); },
  steam2: g => { dot(g, 1, 4, 'a'); dot(g, 2, 2, 'b'); dot(g, 1, 1, 'a'); dot(g, 2, 0, 'b'); }
}, [2, 5], { steam: { frames: ['steam0', 'steam1', 'steam2'], frameRate: 5, repeat: 0 } });
const shootingStar = define(6, 2, { a: 'paper', b: 'frost' }, {
  star0: g => { dot(g, 5, 0, 'a'); dot(g, 4, 1, 'b'); },
  star1: g => { box(g, 3, 0, 3, 1, 'b'); dot(g, 5, 0, 'a'); },
  star2: g => { box(g, 1, 1, 5, 1, 'b'); dot(g, 5, 1, 'a'); }
}, [3, 1], { streak: { frames: ['star0', 'star1', 'star2'], frameRate: 12, repeat: 0 } });
const frostLegend = { a: 'frost', b: 'stone4' } as const;
const frostPainters: Record<string, (g: Grid) => void> = {};
for (let variant = 0; variant < 3; variant++) frostPainters[`frost${variant}`] = g => {
  for (let i = 0; i < 7; i++) {
    const x = (i * 7 + variant * 5) % 16;
    const y = (i * 11 + variant * 3) % 16;
    dot(g, x, y, 'a');
    if (i % 2 === 0) dot(g, x + 1, y, 'b');
  }
};
const morningFrost = define(16, 16, frostLegend, frostPainters, [8, 15]);

export const wildlifeSprites: Record<string, SpriteDef> = {
  bird: birdSprite, fox: foxSprite, wolf: wolfSprite, keepsake: keepsakeSprite, firefly: fireflySprite, leaf: leafSprite, eyes: eyesSprite, rabbit: rabbitSprite, wolfTracks: wolfTracksSprite, gatherPop, smokePuff, spark,
  windStreak, snowFlake, rainStreak, puddle, cookSteam, shootingStar, morningFrost
};

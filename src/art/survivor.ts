import type { SpriteDef } from './sprites';

type Grid = string[][];
const blank = (): Grid => Array.from({ length: 24 }, () => Array.from({ length: 16 }, () => '.'));
const dot = (g: Grid, x: number, y: number, color: string): void => { if (g[y]?.[x] !== undefined) g[y][x] = color; };
const box = (g: Grid, x: number, y: number, width: number, height: number, color: string): void => {
  for (let yy = y; yy < y + height; yy++) for (let xx = x; xx < x + width; xx++) dot(g, xx, yy, color);
};

const legend = {
  a: 'hair0', b: 'hair2', c: 'skin1', d: 'skin3', e: 'skin4',
  f: 'coat0', g: 'coat1', h: 'coat2', i: 'coat3', j: 'coat4',
  k: 'scarf1', l: 'scarf3', m: 'scarf4', n: 'canvas1', o: 'canvas2', p: 'canvas3',
  q: 'wood1', r: 'wood3', s: 'shadow', t: 'frost', u: 'berry2', v: 'berry4'
} as const;

type Pose = 'down' | 'up' | 'side';
function paint(g: Grid, pose: Pose, stride = 0, arm = 0, lean = 0): void {
  const y = lean;
  box(g, 5, 21, 7, 1, 's'); box(g, 3, 22, 11, 1, 's'); box(g, 5, 23, 7, 1, 's');
  box(g, 5 + stride, 19, 3, 3, 'q');
  box(g, 9 - stride, 19, 3, 3, 'q');
  dot(g, 5 + stride, 19, 'r'); dot(g, 9 - stride, 19, 'r');
  if (pose === 'side') {
    box(g, 3, 12 + y, 4, 7, 'n'); box(g, 4, 13 + y, 3, 5, 'o');
  } else if (pose === 'up') {
    box(g, 5, 11 + y, 7, 8, 'n'); box(g, 6, 12 + y, 5, 6, 'o');
    box(g, 7, 13 + y, 3, 3, 'p');
  }
  box(g, 4, 11 + y, 9, 9, 'f'); box(g, 5, 12 + y, 7, 7, 'h');
  box(g, 6, 13 + y, 5, 5, 'i'); box(g, 7, 13 + y, 3, 1, 'j');
  if (pose === 'up') { box(g, 6, 12 + y, 5, 6, 'o'); box(g, 7, 13 + y, 3, 3, 'p'); }
  const leftArmY = 13 + y - Math.max(0, arm);
  const rightArmY = 13 + y - Math.max(0, -arm);
  box(g, 2, leftArmY, 3, 5, 'g'); box(g, 3, leftArmY + 1, 2, 3, 'i');
  box(g, 12, rightArmY, 3, 5, 'g'); box(g, 12, rightArmY + 1, 2, 3, 'i');
  box(g, 3, leftArmY + 4, 2, 2, 'c'); box(g, 12, rightArmY + 4, 2, 2, 'c');
  box(g, 4, 10 + y, 9, 3, 'k'); box(g, 5, 10 + y, 7, 2, 'l');
  box(g, 10, 12 + y, 2, 4, 'l'); dot(g, 10, 15 + y, 'm');
  box(g, 4, 2 + y, 9, 8, 'a'); box(g, 5, 3 + y, 7, 7, 'b');
  if (pose === 'up') {
    box(g, 6, 3 + y, 5, 3, 'a'); box(g, 5, 6 + y, 7, 3, 'b');
    dot(g, 8, 4 + y, 'a');
  } else if (pose === 'side') {
    box(g, 7, 5 + y, 6, 5, 'd'); box(g, 9, 5 + y, 3, 2, 'e');
    box(g, 5, 2 + y, 7, 3, 'a'); dot(g, 12, 7 + y, 'c');
    dot(g, 11, 7 + y, 'a');
  } else {
    box(g, 5, 5 + y, 7, 5, 'd'); box(g, 6, 5 + y, 5, 3, 'e');
    box(g, 4, 2 + y, 9, 3, 'a'); box(g, 5, 4 + y, 2, 3, 'b');
    dot(g, 7, 7 + y, 'a'); dot(g, 10, 7 + y, 'a');
    dot(g, 8, 9 + y, 'c');
  }
}

/** Where the pack sits: seen from behind it covers the back; from the front or side it shows behind the shoulders. */
type PackView = 'front' | 'back' | 'side';
const PACK_VIEW: Record<Pose, PackView> = { down: 'front', up: 'back', side: 'side' };

/** Woven straw on a wooden frame. Behind the survivor it only fills pixels the body leaves clear. */
function wearPack(g: Grid, view: PackView, lean = 0, dx = 0, bare: [number, number][] = []): void {
  const weave = (x: number, y: number, behind: boolean): void => {
    if (behind && g[y]?.[x] !== '.') return;
    dot(g, x, y, (x + y) % 2 === 0 ? 'p' : 'o');
  };
  const rim = (x: number, y: number, behind: boolean): void => {
    if (bare.some(([bx, by]) => bx === x && by === y)) return;
    if (!behind || g[y]?.[x] === '.') dot(g, x, y, 'q');
  };
  const pack = (x0: number, y0: number, width: number, height: number, behind: boolean): void => {
    for (let y = y0; y < y0 + height; y++) for (let x = x0; x < x0 + width; x++) {
      if (y === y0) dot(g, x, y, behind && g[y]?.[x] !== '.' ? g[y][x] : 'r');
      else if (x === x0 || x === x0 + width - 1 || y === y0 + height - 1) rim(x, y, behind);
      else weave(x, y, behind);
    }
  };
  if (view === 'back') {
    pack(5 + dx, 11 + lean, 7, 8, false);
    box(g, 6 + dx, 14 + lean, 5, 1, 'q');
  } else if (view === 'front') {
    pack(2 + dx, 8 + lean, 13, 6, true);
    for (const x of [5, 11]) box(g, x + dx, 13 + lean, 1, 2, 'r');
  } else {
    pack(0 + dx, 10 + lean, 5, 9, true);
  }
}

/** Frames that stand slumped one pixel low, by name; the pack is worn the same distance low. */
const STANDING_LEAN: Record<string, number> = {};

/** A standing frame; its lean is recorded under its name so the pack follows it. */
function stand(name: string, pose: Pose, stride = 0, arm = 0, lean = 0, detail?: (g: Grid) => void): string[] {
  if (lean) STANDING_LEAN[name] = lean;
  return frame(pose, stride, arm, lean, detail);
}

function frame(pose: Pose, stride = 0, arm = 0, lean = 0, detail?: (g: Grid) => void): string[] {
  const g = blank();
  paint(g, pose, stride, arm, lean);
  detail?.(g);
  return g.map(row => row.join(''));
}

function seated(kind: 'rest' | 'cook' | 'stargaze', phase: number): string[] {
  const g = blank();
  box(g, 5, 21, 7, 1, 's'); box(g, 3, 22, 11, 1, 's'); box(g, 5, 23, 7, 1, 's');
  const sway = phase;
  box(g, 5, 18, 8, 3, 'q'); box(g, 9, 19, 5, 2, 'q');
  box(g, 3 + sway, 12, 9, 7, 'f'); box(g, 4 + sway, 13, 7, 6, 'h');
  box(g, 5 + sway, 15, 5, 3, 'i'); box(g, 4 + sway, 11, 9, 2, 'l');
  box(g, 10 + sway, 12, 2, 3, 'm');
  if (kind === 'rest') {
    box(g, 4 + sway, 4, 9, 8, 'a'); box(g, 5 + sway, 6, 7, 5, 'd');
    box(g, 6 + sway, 6, 5, 2, 'e');
    dot(g, 7 + sway, 8, 'a'); dot(g, 10 + sway, 8, 'a');
    box(g, 3 + sway, 13, 2, 5, 'g'); box(g, 12 + sway, 13, 2, 5, 'g');
    box(g, 4 + sway, 18, 9, 2, 'i');
  } else if (kind === 'cook') {
    box(g, 4 + sway, 5, 9, 7, 'a'); box(g, 7 + sway, 7, 6, 4, 'd');
    box(g, 9 + sway, 7, 3, 2, 'e'); dot(g, 11 + sway, 8, 'a');
    box(g, 11, 13, 3, 2, 'i'); box(g, 13, 13, 2, 2, 'c');
    for (let y = 7; y <= 14; y++) dot(g, 14 + Math.floor((14 - y) / 5), y, 'r');
    box(g, 13, 6, 2, 2, 'u'); dot(g, 13, 6, 'v');
    box(g, 14, 9, 2, 2, 'u'); dot(g, 14, 9, 'v');
  } else {
    box(g, 3 + sway, 5, 9, 7, 'a'); box(g, 7 + sway, 4, 5, 5, 'd');
    box(g, 8 + sway, 4, 4, 2, 'e'); dot(g, 10 + sway, 5, 'a');
    box(g, 3 + sway, 13, 2, 4, 'g'); box(g, 11 + sway, 12, 2, 4, 'g');
    box(g, 4 + sway, 15, 3, 1, 'j');
  }
  return g.map(row => row.join(''));
}

/** Slumped one pixel lower with closed, drooping eyes; the second frame yawns. */
function tired(name: string, yawn: boolean): string[] {
  return stand(name, 'down', 0, 0, 1, g => {
    box(g, 6, 8, 2, 1, 'a'); box(g, 10, 8, 2, 1, 'a');
    box(g, 7, 8, 1, 1, 'd'); box(g, 10, 8, 1, 1, 'd');
    if (yawn) box(g, 8, 9, 2, 2, 'a');
  });
}

/** The right hand brought across to rest on the stomach, rubbing up and down. */
function hungry(phase: number): string[] {
  return frame('down', 0, 0, 0, g => {
    box(g, 13, 13, 2, 7, '.'); box(g, 12, 13, 1, 7, 'f');
    box(g, 9, 15 + phase, 4, 2, 'g'); box(g, 7, 15 + phase, 2, 2, 'c');
    box(g, 7, 9, 3, 1, 'c'); dot(g, 7, 9, 'a'); dot(g, 9, 9, 'a');
  });
}

function reaching(): string[] {
  const g = blank();
  box(g, 5, 21, 7, 1, 's'); box(g, 3, 22, 11, 1, 's'); box(g, 5, 23, 7, 1, 's');
  box(g, 4, 18, 3, 4, 'q'); box(g, 10, 18, 3, 4, 'q');
  box(g, 2, 12, 4, 6, 'o'); box(g, 4, 11, 9, 8, 'f'); box(g, 5, 12, 7, 6, 'i');
  box(g, 5, 11, 8, 2, 'l'); box(g, 11, 13, 3, 3, 'g');
  box(g, 13, 14, 3, 2, 'c');
  box(g, 7, 5, 8, 7, 'a'); box(g, 9, 7, 6, 4, 'd');
  box(g, 10, 7, 4, 2, 'e'); dot(g, 13, 8, 'a');
  return g.map(row => row.join(''));
}

const frames: Record<string, string[]> = {
  idleDown0: frame('down'), idleDown1: stand('idleDown1', 'down', 0, 0, 1),
  walkDown0: frame('down', -1, 1), walkDown1: stand('walkDown1', 'down', 0, 0, 1),
  walkDown2: frame('down', 1, -1), walkDown3: frame('down', 0, 1),
  walkUp0: frame('up', -1, 1), walkUp1: stand('walkUp1', 'up', 0, 0, 1),
  walkUp2: frame('up', 1, -1), walkUp3: frame('up', 0, 1),
  walkSide0: frame('side', -1, 1), walkSide1: stand('walkSide1', 'side', 0, 0, 1),
  walkSide2: frame('side', 1, -1), walkSide3: frame('side', 0, 1),
  gather0: stand('gather0', 'side', 0, 2, 1),
  gather1: reaching(),
  rest0: seated('rest', 0), rest1: seated('rest', 1),
  cook0: seated('cook', 0), cook1: seated('cook', 1),
  stargaze0: seated('stargaze', 0), stargaze1: seated('stargaze', 1),
  shiver0: stand('shiver0', 'down', -1, 0, 1, g => { dot(g, 2, 8, 't'); }),
  shiver1: stand('shiver1', 'down', 1, 0, 1, g => { dot(g, 14, 8, 't'); }),
  tired0: tired('tired0', false), tired1: tired('tired1', true),
  hungry0: hungry(0), hungry1: hungry(1)
};

/** How each frame wears the pack: its view, how far it is slumped or seated, and its sideways sway. */
const PACK_FIT: Record<string, [PackView, number, number]> = {
  gather1: ['side', 0, 0],
  rest0: ['front', 1, 0], rest1: ['front', 1, 1],
  cook0: ['side', 0, 0], cook1: ['side', 0, 1],
  stargaze0: ['side', 0, 0], stargaze1: ['side', 0, 1]
};

function packFit(name: string): [PackView, number, number] {
  const fit = PACK_FIT[name];
  if (fit) return fit;
  const pose: Pose = name.startsWith('walkUp') ? 'up' : name.startsWith('walkSide') || name.startsWith('gather') ? 'side' : 'down';
  return [PACK_VIEW[pose], STANDING_LEAN[name] ?? 0, 0];
}

// Every frame has a twin with the woven pack on, named `${name}Pack`; the scene picks it once the pack is woven.
for (const [name, rows] of Object.entries(frames)) {
  const g = rows.map(row => row.split(''));
  const [view, lean, dx] = packFit(name);
  // The hungry frames bring the right arm across, leaving nothing behind it for the front pack's rim to hang on.
  wearPack(g, view, lean, dx, name.startsWith('hungry') ? [[13, 13], [14, 13]] : []);
  frames[`${name}Pack`] = g.map(row => row.join(''));
}

const animations: NonNullable<SpriteDef['animations']> = {};
for (const [name, count] of Object.entries({ idleDown: 2, walkDown: 4, walkUp: 4, walkSide: 4, gather: 2, rest: 2, cook: 2, stargaze: 2, shiver: 2, tired: 2, hungry: 2 })) {
  let frameRate = 4;
  if (name.startsWith('walk')) frameRate = 8;
  else if (['idleDown', 'shiver', 'tired', 'hungry'].includes(name)) frameRate = 2;
  animations[name] = { frames: Array.from({ length: count }, (_, index) => `${name}${index}`), frameRate, repeat: name === 'gather' ? 0 : -1 };
}

export const survivorSprite: SpriteDef = { size: [16, 24], anchor: [8, 22], legend, frames, animations };

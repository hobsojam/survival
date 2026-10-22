import type { SpriteDef } from './sprites';

type Grid = string[][];
const blank = (): Grid => Array.from({ length: 24 }, () => new Array(16).fill('.'));
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
  idleDown0: frame('down'), idleDown1: frame('down', 0, 0, 1),
  walkDown0: frame('down', -1, 1), walkDown1: frame('down', 0, 0, 1),
  walkDown2: frame('down', 1, -1), walkDown3: frame('down', 0, 1),
  walkUp0: frame('up', -1, 1), walkUp1: frame('up', 0, 0, 1),
  walkUp2: frame('up', 1, -1), walkUp3: frame('up', 0, 1),
  walkSide0: frame('side', -1, 1), walkSide1: frame('side', 0, 0, 1),
  walkSide2: frame('side', 1, -1), walkSide3: frame('side', 0, 1),
  gather0: frame('side', 0, 2, 1),
  gather1: reaching(),
  rest0: seated('rest', 0), rest1: seated('rest', 1),
  cook0: seated('cook', 0), cook1: seated('cook', 1),
  stargaze0: seated('stargaze', 0), stargaze1: seated('stargaze', 1),
  shiver0: frame('down', -1, 0, 1, g => { dot(g, 2, 8, 't'); }),
  shiver1: frame('down', 1, 0, 1, g => { dot(g, 14, 8, 't'); })
};

const animations: NonNullable<SpriteDef['animations']> = {};
for (const [name, count] of Object.entries({ idleDown: 2, walkDown: 4, walkUp: 4, walkSide: 4, gather: 2, rest: 2, cook: 2, stargaze: 2, shiver: 2 })) {
  let frameRate = 4;
  if (name.startsWith('walk')) frameRate = 8;
  else if (name === 'idleDown' || name === 'shiver') frameRate = 2;
  animations[name] = { frames: Array.from({ length: count }, (_, index) => `${name}${index}`), frameRate, repeat: name === 'gather' ? 0 : -1 };
}

export const survivorSprite: SpriteDef = { size: [16, 24], anchor: [8, 22], legend, frames, animations };

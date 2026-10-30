import type { JournalId } from '../game/journalEntries';
import { palette, type PaletteKey } from './palette';

// The year journal's little pictures, drawn in the game's own palette so they look the same on every machine.

export const JOURNAL_ICON_SIZE = 10;

export interface JournalIcon { legend: Record<string, PaletteKey>; rows: readonly string[] }

const flame = { r: 'fire1', o: 'fire2', O: 'fire3', W: 'fire4' } as const;
/** A cloud's outline and body, for the snow and rain icons. */
const cloud = (light: PaletteKey, dark: PaletteKey): Record<string, PaletteKey> => ({ c: dark, C: light });

export const JOURNAL_ICONS: Record<JournalId, JournalIcon> = {
  leaves: { legend: { o: 'fire1', O: 'fire2', s: 'wood2' }, rows: [
    '..........',
    '.....oo...',
    '....oOOo..',
    '...oOOOo..',
    '..oOOOo...',
    '..oOOo....',
    '...oo.....',
    '..s.......',
    '.s........',
    '..........'
  ] },
  fox: { legend: { d: 'fox1', O: 'fox2', w: 'fox4', k: 'ink' }, rows: [
    '..........',
    '.d......d.',
    '.dO....Od.',
    '.dOOOOOOd.',
    '.OOkOOkOO.',
    '.wOOOOOOw.',
    '..wwOOww..',
    '...wwww...',
    '....kk....',
    '..........'
  ] },
  coldFront: { legend: { b: 'storm', F: 'frost' }, rows: [
    '....b.....',
    '.b..b..b..',
    '..b.b.b...',
    '...bbb....',
    'bbbbFbbbb.',
    '...bbb....',
    '..b.b.b...',
    '.b..b..b..',
    '....b.....',
    '..........'
  ] },
  driedBerries: { legend: { w: 'wood2', k: 'canvas2', b: 'berry1', B: 'berry3' }, rows: [
    '..........',
    '..........',
    'wwwwwwwwww',
    '..k..k..k.',
    '.bBb.k.bBb',
    '.bbb.k.bbb',
    '..b.bBb.b.',
    '....bbb...',
    '.....b....',
    '..........'
  ] },
  stars: { legend: { y: 'scarf2', Y: 'fire4' }, rows: [
    '..........',
    '...y......',
    '...y......',
    '.yyYyy....',
    '...y...y..',
    '...y..yYy.',
    '.......y..',
    '..y.......',
    '.yYy......',
    '..y.......'
  ] },
  firstSnow: { legend: { ...cloud('stone3', 'stone2'), f: 'flower4' }, rows: [
    '..........',
    '...ccc....',
    '.ccCCCcc..',
    'cCCCCCCCc.',
    '.cccccccc.',
    '..........',
    '.f..f..f..',
    '...f..f...',
    '.f..f..f..',
    '..........'
  ] },
  wolfTracks: { legend: { p: 'earth1' }, rows: [
    '..........',
    '...p..p...',
    '...p..p...',
    '.p......p.',
    '.p.pppp.p.',
    '..pppppp..',
    '..pppppp..',
    '...pppp...',
    '..........',
    '..........'
  ] },
  frozenSpring: { legend: { s: 'stone2', I: 'frost', i: 'flower4' }, rows: [
    '..........',
    '..........',
    '..ssssss..',
    '.sIIIIiIs.',
    'sIiIIIiIIs',
    'sIIiIiIIIs',
    '.sIIIIIIs.',
    '..ssssss..',
    '..........',
    '..........'
  ] },
  winterFire: { legend: { ...flame, d: 'wood1', w: 'wood2' }, rows: [
    '....r.....',
    '....rr....',
    '...ror....',
    '..roOor.r.',
    '..roOOorr.',
    '.roOWOOor.',
    '.roOWWOor.',
    '..ooOOoo..',
    '.ddwwwwdd.',
    '..dd..dd..'
  ] },
  winterCooking: { legend: { k: 'stone0', K: 'stone1', B: 'berry2', s: 'stone3' }, rows: [
    '..s...s...',
    '...s...s..',
    '..s...s...',
    '..........',
    'kkkkkkkkkk',
    '.kBBBBBBk.',
    '.kkkkkkkk.',
    '.kKKKKKKk.',
    '..kKKKKk..',
    '...kkkk...'
  ] },
  firstRain: { legend: { ...cloud('stone2', 'stone1'), r: 'storm' }, rows: [
    '..........',
    '...ccc....',
    '.ccCCCcc..',
    'cCCCCCCCc.',
    '.cccccccc.',
    '..r...r...',
    '.r..r...r.',
    '...r...r..',
    '.r...r....',
    '..........'
  ] },
  rabbits: { legend: { e: 'bird2', W: 'flower2', k: 'ink' }, rows: [
    '...e.e....',
    '...e.e....',
    '...eeee...',
    '..ekeeee..',
    '..eeeeee..',
    '....eeeee.',
    '...eeeeeee',
    '...eeeeeeW',
    '...ee..ee.',
    '..........'
  ] },
  bushesFull: { legend: { l: 'leaf2', L: 'leaf3', b: 'berry2' }, rows: [
    '..........',
    '...ll.....',
    '..lLLll...',
    '.lLbLLLl..',
    '.lLLLLbLl.',
    'lLbLLLLLl.',
    'lLLLLbLLLl',
    '.lLLLLLLl.',
    '..llllll..',
    '..........'
  ] },
  stumpGrowing: { legend: { g: 'leaf3', G: 'leaf4', w: 'wood1', W: 'wood3', d: 'wood2' }, rows: [
    '..........',
    '.....gg...',
    '...gg.g...',
    '....gGg...',
    '.....g....',
    '..wwwwww..',
    '.wWWWWWWw.',
    '.wddddddw.',
    '.wddddddw.',
    'wwwwwwwwww'
  ] },
  springRest: { legend: { b: 'storm', B: 'flower4', W: 'frost' }, rows: [
    '....b.....',
    '....b.....',
    '...bBb....',
    '...bBb....',
    '..bBBBb...',
    '..bBWBb...',
    '.bBBWBBb..',
    '.bBBBBBb..',
    '..bBBBb...',
    '...bbb....'
  ] },
  fireflies: { legend: { g: 'grass3', Y: 'scarf3' }, rows: [
    '..........',
    '.g........',
    'gYg....g..',
    '.g....gYg.',
    '.......g..',
    '...g......',
    '..gYg.....',
    '...g...g..',
    '......gYg.',
    '.......g..'
  ] },
  twoHandfuls: { legend: { h: 'skin2', b: 'berry1', B: 'berry3' }, rows: [
    '..........',
    '..........',
    '..b.B.b...',
    '.bBbBbBb..',
    'bBbBbBbBb.',
    'hbbbbbbbh.',
    'hhhbbbhhh.',
    '.hhhhhhh..',
    '..hhhhh...',
    '..........'
  ] },
  goldEvening: { legend: { y: 'fire2', Y: 'golden', W: 'fire4', g: 'grass1', G: 'grass0' }, rows: [
    '..........',
    '..........',
    '...yyyy...',
    '..yYYYYy..',
    '.yYYWWYYy.',
    '.yYYYYYYy.',
    'gggggggggg',
    'GGGGGGGGGG',
    '..........',
    '..........'
  ] },
  warmSleep: { legend: { m: 'scarf2' }, rows: [
    '..........',
    '...mmmm...',
    '..mmm.....',
    '.mmm....m.',
    '.mmm......',
    '.mmm......',
    '.mmmm.....',
    '..mmmmmm..',
    '...mmmm...',
    '..........'
  ] },
  lookoutEvening: { legend: { w: 'wood2', W: 'wood3', d: 'wood1' }, rows: [
    '....ww....',
    '..wwWWww..',
    '.wWWWWWWw.',
    '..d....d..',
    '..dwwwwd..',
    '..d.d..d..',
    '..d..d.d..',
    '..d...dd..',
    '.dd....dd.',
    '..........'
  ] },
  hazelnuts: { legend: { n: 'wood3', N: 'wood1', l: 'fire1', L: 'fire2' }, rows: [
    '..........',
    '...N......',
    '..nnn.....',
    '.nnnnn.l..',
    '.nnNnn.Ll.',
    '..nnn.lLl.',
    '..........',
    '.l.nn..L..',
    '..nnnn.l..',
    '...nn.....'
  ] },
  pineTea: { legend: { g: 'leaf3', G: 'leaf2', k: 'stone0', t: 'wood3', s: 'stone3' }, rows: [
    '..s...s...',
    '...s......',
    '..G.G.G...',
    '.kkkkkkk..',
    '.ktttttkk.',
    '.kttttttk.',
    '.kgGgGgk.k',
    '..kttttk.k',
    '...kkkkkk.',
    '..........'
  ] },
  salad: { legend: { g: 'leaf4', G: 'leaf3', b: 'berry3', B: 'berry2', w: 'wood3' }, rows: [
    '..........',
    '..........',
    '..gG.gG...',
    '.gGbGgGBg.',
    '.GgGGbGgG.',
    'wwwwwwwwww',
    '.wwwwwwww.',
    '..wwwwww..',
    '...wwww...',
    '..........'
  ] },
  wildHoney: { legend: { h: 'wood4', H: 'fire3', o: 'fire2', w: 'wood2', d: 'wood1' }, rows: [
    '...dddd...',
    '..dwwwwd..',
    '..dwddwd..',
    '..dwddwd..',
    '..dwwwwd..',
    '...hHh....',
    '...HoH....',
    '...hoh....',
    '....H.....',
    '....h.....'
  ] }
};

/** The icon as a small SVG, one square per pixel, ready for a CSS background. */
export function journalIconUrl(id: JournalId): string {
  return iconUrl(JOURNAL_ICONS[id]);
}

/** Paints a 10×10 icon as a crisp SVG data URL in the game palette. */
export function iconUrl({ legend, rows }: JournalIcon): string {
  const pixels = rows.flatMap((row, y) => [...row].flatMap((pixel, x) =>
    pixel === '.' ? [] : [`<rect x="${x}" y="${y}" width="1" height="1" fill="${palette[legend[pixel]]}"/>`]));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${JOURNAL_ICON_SIZE} ${JOURNAL_ICON_SIZE}" shape-rendering="crispEdges">${pixels.join('')}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

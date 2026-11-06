import type { JournalId } from '../game/journalEntries';
import { palette, type PaletteKey } from './palette';

// The year journal's little pictures, drawn in the game's own palette so they look the same on every machine.

export const JOURNAL_ICON_SIZE = 10;

export interface JournalIcon { legend: Record<string, PaletteKey>; rows: readonly string[] }

const flame = { r: 'fire1', o: 'fire2', O: 'fire3', W: 'fire4' } as const;
/** A cloud's outline and body, for the snow and rain icons. */
const cloud = (light: PaletteKey, dark: PaletteKey): Record<string, PaletteKey> => ({ c: dark, C: light });

/** A feather beside a tuft of fur, with a touch of the season in the corner: the same picture for either find. */
const keepsakeIcon = (accent: PaletteKey, top: readonly [string, string]): JournalIcon => ({
  legend: { x: accent, g: 'stone2', w: 'stone4', k: 'wood1', f: 'fox2', F: 'fox3' },
  rows: [...top, '..gg......', '.gwwg.....', '.gwwg.....', '..gwg.ff..', '..gw.fFFf.', '...k.fFFf.', '...k..ff..', '..........']
});

/** A little paw with a touch of the season in the corner: the lines about an animal with a name. */
const namedIcon = (accent: PaletteKey, top: readonly [string, string]): JournalIcon => ({
  legend: { x: accent, k: 'wood1', K: 'wood2' },
  rows: [...top, '..........', '.k.k......', '.k.k.k....', '..KKK.....', '.KKKKK....', '.KKKKK....', '..KKK.....', '..........']
});

/** A low hill with a little of its season showing, in the marks of its own top rows. */
const hillIcon = (slope: PaletteKey, mark: PaletteKey, top: readonly [string, string, string]): JournalIcon => ({
  legend: { s: slope, t: mark },
  rows: ['..........', ...top, '.ssssss...', 'ssssssssss', 'ssssssssss', 'ssssssssss', 'ssssssssss', '..........']
});

export const JOURNAL_ICONS: Record<JournalId, JournalIcon> = {
  hillsAutumn: hillIcon('fox1', 'fox3', ['.t.....t..', 'tt.t..tt.t', '.t..t..t..']),
  hillsWinter: hillIcon('frost', 'paper', ['...tt.....', '..tttt....', '.tttttt...']),
  hillsSpring: hillIcon('leaf2', 'flower1', ['..........', '..t...tt..', '.ttt.tttt.']),
  hillsSummer: hillIcon('leaf2', 'flower3', ['..........', '.t.t.t.t..', 'tttttttttt']),
  namedAutumn: namedIcon('fire2', ['.......xx.', '........x.']),
  namedWinter: namedIcon('frost', ['.......x.x', '........x.']),
  namedSpring: namedIcon('leaf3', ['........x.', '.......xx.']),
  namedSummer: namedIcon('scarf3', ['.......xx.', '.......xx.']),
  autumnKeepsake: keepsakeIcon('fire2', ['.......xx.', '........x.']),
  winterKeepsake: keepsakeIcon('frost', ['.......x.x', '........x.']),
  // An apple with a leaf.
  orchardApple: { legend: { r: 'fire2', g: 'leaf3', k: 'ink' }, rows: [
    '.....kg...',
    '.....kgg..',
    '..rrrkrr..',
    '.rrrrrrrr.',
    '.rrrrrrrr.',
    '.rrrrrrrr.',
    '.rrrrrrrr.',
    '..rrrrrr..',
    '...rr.rr..',
    '..........'
  ] },
  // A little sheep, seen from the side.
  shearing: { legend: { w: 'paper', x: 'canvas3', k: 'ink', l: 'stone1' }, rows: [
    '..........',
    '...wwww...',
    '.wwwwwwww.',
    'wwwwwwwwkk',
    'wwwwwwwwkk',
    'xwwwwwwwk.',
    '.xxxxxxx..',
    '.l.l.l.l..',
    '.l.l.l.l..',
    '..........'
  ] },
  springKeepsake: keepsakeIcon('leaf3', ['........x.', '.......xx.']),
  summerKeepsake: keepsakeIcon('scarf3', ['.......xx.', '.......xx.']),
  // A sheaf of grain, tied round its middle.
  grainIn: { legend: { g: 'scarf2', G: 'scarf3', W: 'scarf4', t: 'wood1' }, rows: [
    '..........',
    '..W.W.W...',
    '.WGWGWGW..',
    '..GgGgG...',
    '...ggg....',
    '...ttt....',
    '...ggg....',
    '..g.g.g...',
    '.g..g..g..',
    '..........'
  ] },
  // A round loaf on a board, steam rising.
  winterBread: { legend: { k: 'wood1', c: 'earth2', C: 'earth3', W: 'earth4', b: 'wood3', s: 'frost' }, rows: [
    '...s..s...',
    '..s..s....',
    '..........',
    '...kkkk...',
    '..kCWWCk..',
    '.kCWCCWCk.',
    '.kcCCCCck.',
    'bbbbbbbbbb',
    '.b......b.',
    '..........'
  ] },
  // A sheaf of grain with an autumn leaf falling past it.
  autumnGrain: { legend: { g: 'scarf2', G: 'scarf3', t: 'wood1', o: 'fire1', O: 'fire2' }, rows: [
    '......oO..',
    '.......o..',
    '.G.G.G....',
    '..GgG.....',
    '...g......',
    '..ttt.....',
    '...g......',
    '..g.g.....',
    '.g..g.g...',
    '..........'
  ] },
  // A loaf on a board under a summer sun.
  summerBread: { legend: { k: 'wood1', c: 'earth2', C: 'earth3', W: 'earth4', b: 'wood3', y: 'fire3', Y: 'fire4' }, rows: [
    '.......y.y',
    '........Y.',
    '.......y.y',
    '..kkkk....',
    '.kCWWCk...',
    'kCWCCWCk..',
    'kcCCCCck..',
    'bbbbbbbbbb',
    '.b......b.',
    '..........'
  ] },
  // A stone oven's arched mouth with a loaf inside, smoke curling from its chimney.
  ovenBread: { legend: { s: 'stone1', S: 'stone2', k: 'ink', c: 'earth2', C: 'earth3', m: 'frost' }, rows: [
    '.......m..',
    '......m...',
    '......SS..',
    '..SSSSSS..',
    '.SSSSSSSS.',
    '.SSkkkkSS.',
    '.SkcCCckS.',
    '.SkkkkkkS.',
    'ssssssssss',
    '..........'
  ] },
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
  fireside: { legend: { ...flame, d: 'wood1', w: 'wood2', s: 'stone1' }, rows: [
    '......ss..',
    '...dd.ss..',
    '..dwwdss..',
    '.dwwwwdd..',
    'dwwwwwwwd.',
    '.wwwwwwww.',
    '.wwroOwww.',
    '.wwoWOwww.',
    '.wwwwwwww.',
    '.dddddddd.'
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

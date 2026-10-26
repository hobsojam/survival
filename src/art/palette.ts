/** Named colors from the Hearthwild pixel-art direction spec. */
export const palette = {
  grass0: '#2f5236', grass1: '#3d6b3f', grass2: '#5a8a45', grass3: '#7aa64f', grass4: '#a3c45e',
  leaf0: '#16302e', leaf1: '#1f4a3a', leaf2: '#2f6b44', leaf3: '#4a8f4c', leaf4: '#7db55a',
  // Broadleaf crowns: the same greens as leaf, but they turn with the seasons while pines keep theirs.
  crown0: '#16302e', crown1: '#1f4a3a', crown2: '#2f6b44', crown3: '#4a8f4c', crown4: '#7db55a',
  earth0: '#3a2620', earth1: '#5c3d2b', earth2: '#8a5f3c', earth3: '#b58a5a', earth4: '#dbb985',
  wood0: '#2e1c18', wood1: '#573423', wood2: '#85512f', wood3: '#b07a47', wood4: '#d9a86a',
  stone0: '#2b2d3a', stone1: '#4d5161', stone2: '#767b88', stone3: '#a3a7ad', stone4: '#d0d2cc',
  canvas0: '#4a3a2c', canvas1: '#7a6448', canvas2: '#b39a6e', canvas3: '#d9c595', canvas4: '#f0e2b8',
  berry0: '#4a1426', berry1: '#6b1e33', berry2: '#b83a45', berry3: '#e8665a', berry4: '#ffc2a8',
  fire0: '#7a2614', fire1: '#c4471c', fire2: '#ef7d23', fire3: '#ffb84a', fire4: '#ffe58a',
  fox0: '#4a2014', fox1: '#7a3418', fox2: '#c25a24', fox3: '#e88a3e', fox4: '#f2e2c4',
  bird0: '#2e2420', bird1: '#4a3528', bird2: '#7d5a40', bird3: '#b08a62', bird4: '#e3c9a0',
  coat0: '#3a1c22', coat1: '#5e2a2e', coat2: '#9c3f3a', coat3: '#c9644c', coat4: '#e88c6a',
  scarf0: '#5e3f1c', scarf1: '#8a5f22', scarf2: '#b7832f', scarf3: '#e3b552', scarf4: '#f5d98a',
  skin0: '#4a2a24', skin1: '#8a5040', skin2: '#c98a68', skin3: '#efc39c', skin4: '#fbe0c4',
  hair0: '#1c1418', hair1: '#3a2826', hair2: '#5e4038', hair3: '#7e5a48', hair4: '#9e7a60',
  flower0: '#5e3a6e', flower1: '#e6c25a', flower2: '#f2f0e0', flower3: '#e88aa0', flower4: '#8ab0e0',
  ink: '#1c1820', paper: '#f7f1e1', beak: '#e0a040', shadow: '#1a2a24',
  night: '#1a2140', dusk: '#f0a050', dawn: '#e8a0a8', storm: '#23405a', frost: '#d8eef0', firefly: '#e9f79a'
} as const;

export type PaletteKey = keyof typeof palette;

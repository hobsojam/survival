export interface FoodStore {
  berry: number[];
  greens: number[];
  hazelnut: number;
  honey: number;
  pineNeedles: number;
  roastedHazelnuts: number;
  trailFood: number;
  vegetables: number;
  fish: number;
  /** Brought by a wolf friend in winter; never eaten raw. */
  rabbit: number;
}

export function emptyFood(): FoodStore {
  return { berry: [], greens: [], hazelnut: 0, honey: 0, pineNeedles: 0, roastedHazelnuts: 0, trailFood: 0, vegetables: 0, fish: 0, rabbit: 0 };
}

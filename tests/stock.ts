import { addFood, emptyFood, type FoodStore } from '../src/game/food';

/** A food store holding berries picked on day 1, and rations. */
export const stock = (berries: number, rations = 0): FoodStore =>
  addFood(addFood(emptyFood(), 'berry', berries, 1), 'trailFood', rations, 1);

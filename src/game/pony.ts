// The wild pony on the hills, won over slowly with apples or vegetables. Once it has its horseshoes it walks beside the
// survivor and carries a load. It is not one of the animal friends: it gives no gifts or keepsakes, and it never leaves.

export interface PonyState {
  /** Offers it has taken. */
  trust: number;
  /** The day of the last offer. */
  lastOffer: number | null;
  /** The day it was won over. */
  won: number | null;
  /** Whether it has reached camp since it was won. */
  home: boolean;
  /** The day it was shod. */
  shod: number | null;
  /** Which of its spots on the hills it is grazing at. */
  spot: number;
  /** Whether the survivor has been told why an unshod pony stays at camp. */
  toldHooves: boolean;
}

export const emptyPony = (): PonyState => ({ trust: 0, lastOffer: null, won: null, home: false, shod: null, spot: 0, toldHooves: false });

/** Where the wild pony grazes, near the top of the hills. */
export const PONY_SPOTS = [{ x: 14, y: 9 }, { x: 20, y: 7 }, { x: 24, y: 11 }, { x: 17, y: 13 }] as const;

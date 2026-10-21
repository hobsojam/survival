export const LOGICAL_WIDTH = 480;
export const LOGICAL_HEIGHT = 300;

/** Largest whole scale that fits; fit fractionally below 2×. */
export function displayScale(width: number, height: number): number {
  const fit = Math.min(width / LOGICAL_WIDTH, height / LOGICAL_HEIGHT);
  return fit >= 2 ? Math.floor(fit) : fit;
}

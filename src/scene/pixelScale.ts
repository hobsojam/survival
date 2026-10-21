export const LOGICAL_WIDTH = 480;
export const LOGICAL_HEIGHT = 300;

/** Largest whole scale that fits. Compact frames show less of the world. */
export function displayScale(width: number, height: number): number {
  const fit = Math.min(width / LOGICAL_WIDTH, height / LOGICAL_HEIGHT);
  return Math.max(1, Math.floor(fit));
}

export function viewportSize(width: number, height: number): { width: number; height: number } {
  return { width: Math.min(LOGICAL_WIDTH, Math.floor(width)), height: Math.min(LOGICAL_HEIGHT, Math.floor(height)) };
}

export function canvasOffset(frameWidth: number, frameHeight: number, width: number, height: number, scale: number): { x: number; y: number } {
  return { x: Math.floor((frameWidth - width * scale) / 2), y: Math.floor((frameHeight - height * scale) / 2) };
}

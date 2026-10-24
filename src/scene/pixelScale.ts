export const LOGICAL_WIDTH = 480;
export const LOGICAL_HEIGHT = 300;

/** Largest whole scale that fits. Compact frames show less of the world. */
export function displayScale(width: number, height: number): number {
  const fit = Math.min(width / LOGICAL_WIDTH, height / LOGICAL_HEIGHT);
  return Math.max(1, Math.floor(fit));
}

/** The map's full height (30 tiles of 16 px); tall portrait frames may show all of it. */
export const PORTRAIT_MAX_HEIGHT = 480;

export function viewportSize(width: number, height: number): { width: number; height: number } {
  const maxHeight = height > width ? PORTRAIT_MAX_HEIGHT : LOGICAL_HEIGHT;
  return { width: Math.min(LOGICAL_WIDTH, Math.floor(width)), height: Math.min(maxHeight, Math.floor(height)) };
}

export function canvasOffset(frameWidth: number, frameHeight: number, width: number, height: number, scale: number): { x: number; y: number } {
  return { x: Math.floor((frameWidth - width * scale) / 2), y: Math.floor((frameHeight - height * scale) / 2) };
}

/** Phone portrait frames (the CSS phone layout's width) get magnified art and a viewport that fills them; others return null. */
export function portraitViewport(width: number, height: number): { scale: number; width: number; height: number } | null {
  if (height <= width || width > 600) return null;
  const scale = Math.max(1, Math.floor(width / 160));
  return { scale, width: Math.min(LOGICAL_WIDTH, Math.floor(width / scale)), height: Math.min(PORTRAIT_MAX_HEIGHT, Math.floor(height / scale)) };
}

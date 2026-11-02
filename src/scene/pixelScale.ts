export const LOGICAL_WIDTH = 480;
export const LOGICAL_HEIGHT = 300;

/**
 * The largest crisp scale that fits: a whole number of CSS pixels per art pixel, or on a high-density screen, a whole
 * number of screen pixels per art pixel where that is bigger (a 1920x1200 laptop at 150% gets 4/3, two screen pixels to
 * an art pixel, rather than 1). Never below 1; compact frames show less of the world.
 */
export function displayScale(width: number, height: number, pixelRatio: number = 1): number {
  const fit = Math.min(width / LOGICAL_WIDTH, height / LOGICAL_HEIGHT);
  const whole = Math.max(1, Math.floor(fit));
  const onScreen = Math.floor(fit * pixelRatio + 1e-9) / pixelRatio;
  return Math.max(whole, onScreen);
}

/** The canvas's size on the page, in CSS pixels that land on whole screen pixels. */
export function canvasDisplaySize(width: number, height: number, scale: number, pixelRatio: number = 1): { width: number; height: number } {
  const snap = (value: number) => Math.round(value * scale * pixelRatio) / pixelRatio;
  return { width: snap(width), height: snap(height) };
}

/** The map's full height (30 tiles of 16 px); tall portrait frames may show all of it. */
export const PORTRAIT_MAX_HEIGHT = 480;

export function viewportSize(width: number, height: number): { width: number; height: number } {
  const maxHeight = height > width ? PORTRAIT_MAX_HEIGHT : LOGICAL_HEIGHT;
  return { width: Math.min(LOGICAL_WIDTH, Math.floor(width)), height: Math.min(maxHeight, Math.floor(height)) };
}

/**
 * Where the canvas sits to be centred in the frame, so that it starts on a whole screen pixel; `origin` is where the
 * frame's content starts on the page, in CSS pixels, which may itself fall between screen pixels.
 */
export function canvasOffset(frameWidth: number, frameHeight: number, width: number, height: number, scale: number, pixelRatio: number = 1,
  origin: { x: number; y: number } = { x: 0, y: 0 }): { x: number; y: number } {
  const size = canvasDisplaySize(width, height, scale, pixelRatio);
  const centre = (start: number, frame: number, drawn: number) => Math.floor((start + (frame - drawn) / 2) * pixelRatio + 1e-6) / pixelRatio - start;
  return { x: centre(origin.x, frameWidth, size.width), y: centre(origin.y, frameHeight, size.height) };
}

/** Phone portrait frames (the CSS phone layout's width) get magnified art and a viewport that fills them; others return null. */
export function portraitViewport(width: number, height: number): { scale: number; width: number; height: number } | null {
  if (height <= width || width > 600) return null;
  const scale = Math.max(1, Math.floor(width / 160));
  return { scale, width: Math.min(LOGICAL_WIDTH, Math.floor(width / scale)), height: Math.min(PORTRAIT_MAX_HEIGHT, Math.floor(height / scale)) };
}

/** Everything the page needs to fit the canvas in its frame: the scale, the world viewport, and the canvas's size and place. */
export interface CanvasLayout { scale: number; viewport: { width: number; height: number }; size: { width: number; height: number }; offset: { x: number; y: number } }

/**
 * How the canvas fits a frame of this size: phone portrait frames get magnified art filling them; elsewhere the largest
 * crisp scale, with a compact frame at 1x showing less of the world. `origin` is where the canvas's holder starts on the page.
 */
export function canvasLayout(frameWidth: number, frameHeight: number, pixelRatio: number = 1, origin: { x: number; y: number } = { x: 0, y: 0 }): CanvasLayout {
  const portrait = portraitViewport(frameWidth, frameHeight);
  const scale = portrait?.scale ?? displayScale(frameWidth, frameHeight, pixelRatio);
  const viewport = portrait ? { width: portrait.width, height: portrait.height }
    : scale === 1 ? viewportSize(frameWidth, frameHeight) : { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };
  return {
    scale,
    viewport,
    size: canvasDisplaySize(viewport.width, viewport.height, scale, pixelRatio),
    offset: canvasOffset(frameWidth, frameHeight, viewport.width, viewport.height, scale, pixelRatio, origin)
  };
}

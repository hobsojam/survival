export const LOGICAL_WIDTH = 480;
export const LOGICAL_HEIGHT = 300;

/** The least of the world a frame should show (25 by 15 or so tiles): the art grows only as far as this leaves in view. */
const MIN_VIEW_WIDTH = 400;
const MIN_VIEW_HEIGHT = 250;
/** The whole map (40 by 30 tiles of 16 px): there is nothing to show past it. */
const MAP_WIDTH = 640;
const MAP_HEIGHT = 480;

/**
 * The largest crisp scale that still shows enough of the world: a whole number of CSS pixels per art pixel, or on a
 * high-density screen, a whole number of screen pixels per art pixel where that is bigger (a frame 1000 wide on a 150%
 * screen gets 7/3 rather than 2). Never below 1; compact frames show less of the world.
 */
export function displayScale(width: number, height: number, pixelRatio: number = 1): number {
  const fit = Math.min(width / MIN_VIEW_WIDTH, height / MIN_VIEW_HEIGHT);
  const whole = Math.max(1, Math.floor(fit));
  const onScreen = Math.floor(fit * pixelRatio + 1e-9) / pixelRatio;
  return Math.max(whole, onScreen);
}

/** The canvas's size on the page, in CSS pixels that land on whole screen pixels. */
export function canvasDisplaySize(width: number, height: number, scale: number, pixelRatio: number = 1): { width: number; height: number } {
  const snap = (value: number) => Math.round(value * scale * pixelRatio) / pixelRatio;
  return { width: snap(width), height: snap(height) };
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
  return { scale, width: Math.min(LOGICAL_WIDTH, Math.floor(width / scale)), height: Math.min(MAP_HEIGHT, Math.floor(height / scale)) };
}

/** Everything the page needs to fit the canvas in its frame: the scale, the world viewport, and the canvas's size and place. */
export interface CanvasLayout { scale: number; viewport: { width: number; height: number }; size: { width: number; height: number }; offset: { x: number; y: number } }

/**
 * How the canvas fits a frame of this size: the world viewport fills it at the crisp scale, up to the whole map. Phone
 * portrait frames get art magnified for thumbs. `origin` is where the canvas's holder starts on the page.
 */
export function canvasLayout(frameWidth: number, frameHeight: number, pixelRatio: number = 1, origin: { x: number; y: number } = { x: 0, y: 0 }): CanvasLayout {
  const portrait = portraitViewport(frameWidth, frameHeight);
  const scale = portrait?.scale ?? displayScale(frameWidth, frameHeight, pixelRatio);
  const viewport = portrait ? { width: portrait.width, height: portrait.height }
    : { width: Math.min(MAP_WIDTH, Math.floor(frameWidth / scale + 1e-9)), height: Math.min(MAP_HEIGHT, Math.floor(frameHeight / scale + 1e-9)) };
  return {
    scale,
    viewport,
    size: canvasDisplaySize(viewport.width, viewport.height, scale, pixelRatio),
    offset: canvasOffset(frameWidth, frameHeight, viewport.width, viewport.height, scale, pixelRatio, origin)
  };
}

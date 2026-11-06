// The view from the keep has to be seen whole. A phone on its side can show less than the game frame's height, and a
// swipe to find the rest would count as a tap and bring the player down.

interface FrameElement {
  getBoundingClientRect(): { top: number; bottom: number; height: number };
  scrollIntoView(options: ScrollIntoViewOptions): void;
}

/** Scrolls the game frame into sight, favouring its bottom, where the camp and the season's line are, if it can't all fit. */
export function revealFrame(frame: FrameElement, windowHeight: number): void {
  const { top, bottom, height } = frame.getBoundingClientRect();
  if (height > windowHeight) frame.scrollIntoView({ block: 'end' });
  else if (top < 0 || bottom > windowHeight) frame.scrollIntoView({ block: 'nearest' });
}

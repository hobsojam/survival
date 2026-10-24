/** The phone dock's slide-up sheets. */
export type DockTab = 'bag' | 'build' | 'camp';

/** Tapping the open tab closes it; any other tab opens in its place. */
export function nextOpenTab(open: DockTab | null, tapped: DockTab): DockTab | null {
  return open === tapped ? null : tapped;
}

/** A tap on the game with a sheet open only closes it, unless the dock is hidden (the screen rotated or widened). */
export function gateTap(open: DockTab | null, dockVisible: boolean): { allowTap: boolean; closeTab: boolean } {
  if (!open) return { allowTap: true, closeTab: false };
  return { allowTap: !dockVisible, closeTab: true };
}

/** The phone dock's slide-up sheets. */
export type DockTab = 'bag' | 'build' | 'camp';

/** Tapping the open tab closes it; any other tab opens in its place. */
export function nextOpenTab(open: DockTab | null, tapped: DockTab): DockTab | null {
  return open === tapped ? null : tapped;
}

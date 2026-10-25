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

const DOCK_TABS: readonly DockTab[] = ['bag', 'build', 'camp'];

/** The desktop sidebar always shows one tab: the one saved last time, or Build. */
export function sidebarTab(saved: string | null): DockTab {
  return DOCK_TABS.find(tab => tab === saved) ?? 'build';
}

const SIDEBAR_TAB_KEY = 'hearthwild.sidebarTab';

/** The tab saved last time; storage can be missing or blocked, which just means Build. */
export function loadSidebarTab(storage: Pick<Storage, 'getItem'> | undefined): DockTab {
  try { return sidebarTab(storage?.getItem(SIDEBAR_TAB_KEY) ?? null); } catch { return sidebarTab(null); }
}

export function saveSidebarTab(storage: Pick<Storage, 'setItem'> | undefined, tab: DockTab): void {
  try { storage?.setItem(SIDEBAR_TAB_KEY, tab); } catch { /* storage unavailable: the tab just isn't remembered */ }
}

/** The parts of a tab button the sidebar touches. */
export interface TabButton {
  dataset: DOMStringMap;
  classList: { toggle(name: string, force: boolean): boolean };
  setAttribute(name: string, value: string): void;
}

/** Marks the layout with the open tab, which the stylesheet uses to show its panels, and selects its button. */
export function showSidebarTab(layout: { dataset: DOMStringMap }, buttons: Iterable<TabButton>, tab: DockTab): void {
  layout.dataset.sidebarTab = tab;
  for (const button of buttons) {
    const selected = button.dataset.sidebarButton === tab;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-selected', String(selected));
  }
}

interface ClickableTab extends TabButton {
  addEventListener(type: 'click', listener: () => void): void;
}

/** Opens the remembered sidebar tab and switches tabs on click, remembering each choice. */
export function wireSidebarTabs(
  root: { querySelector(selector: '.layout'): { dataset: DOMStringMap } | null; querySelectorAll(selector: '[data-sidebar-button]'): Iterable<ClickableTab> },
  storage: Pick<Storage, 'getItem' | 'setItem'> | undefined
): void {
  const layout = root.querySelector('.layout');
  if (!layout) return;
  const buttons = [...root.querySelectorAll('[data-sidebar-button]')];
  const open = (tab: DockTab) => {
    showSidebarTab(layout, buttons, tab);
    saveSidebarTab(storage, tab);
  };
  for (const button of buttons) button.addEventListener('click', () => open(sidebarTab(button.dataset.sidebarButton ?? null)));
  open(loadSidebarTab(storage));
}

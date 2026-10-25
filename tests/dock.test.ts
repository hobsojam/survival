import { describe, expect, it } from 'vitest';
import { gateTap, loadSidebarTab, nextOpenTab, saveSidebarTab, showSidebarTab, sidebarTab, wireSidebarTabs, type TabButton } from '../src/ui/dock';

describe('phone dock tabs', () => {
  it('opens a tab, closes it on a second tap, and switches between tabs', () => {
    expect(nextOpenTab(null, 'bag')).toBe('bag');
    expect(nextOpenTab('bag', 'bag')).toBeNull();
    expect(nextOpenTab('bag', 'build')).toBe('build');
  });

  it('lets taps through when no sheet is open', () => {
    expect(gateTap(null, true)).toEqual({ allowTap: true, closeTab: false });
  });

  it('closes an open sheet instead of walking', () => {
    expect(gateTap('bag', true)).toEqual({ allowTap: false, closeTab: true });
  });

  it('never swallows a tap for a sheet left open after the dock is hidden, such as after rotating', () => {
    expect(gateTap('bag', false)).toEqual({ allowTap: true, closeTab: true });
  });
});

describe('desktop sidebar tabs', () => {
  it('reopens the remembered tab, or Build when nothing valid was saved', () => {
    expect(sidebarTab('camp')).toBe('camp');
    expect(sidebarTab('bag')).toBe('bag');
    expect(sidebarTab(null)).toBe('build');
    expect(sidebarTab('journal')).toBe('build');
  });
});

const memory = () => { const saved = new Map<string, string>(); return { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => { saved.set(key, value); } }; };

describe('remembering the sidebar tab', () => {
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };

  it('saves the open tab and reads it back next time', () => {
    const storage = memory();
    expect(loadSidebarTab(storage)).toBe('build');
    saveSidebarTab(storage, 'camp');
    expect(loadSidebarTab(storage)).toBe('camp');
  });

  it('falls back to Build when storage is missing or blocked', () => {
    expect(loadSidebarTab(undefined)).toBe('build');
    expect(loadSidebarTab(broken)).toBe('build');
    expect(() => saveSidebarTab(broken, 'bag')).not.toThrow();
    expect(() => saveSidebarTab(undefined, 'bag')).not.toThrow();
  });
});

describe('showing a sidebar tab', () => {
  type FakeButton = TabButton & { classes: Set<string>; attributes: Map<string, string>; click?: () => void; addEventListener(type: 'click', listener: () => void): void };
  function button(tab: string): FakeButton {
    const classes = new Set<string>();
    const attributes = new Map<string, string>();
    const fake: FakeButton = { classes, attributes, dataset: { sidebarButton: tab },
      addEventListener: (_type, listener) => { fake.click = listener; },
      classList: { toggle: (name: string, on: boolean) => { if (on) classes.add(name); else classes.delete(name); return on; } },
      setAttribute: (name: string, value: string) => { attributes.set(name, value); } };
    return fake;
  }

  it('marks the chosen tab on the layout and selects only its button', () => {
    const layout = { dataset: {} as DOMStringMap };
    const buttons = ['bag', 'build', 'camp'].map(button);
    showSidebarTab(layout, buttons, 'build');
    showSidebarTab(layout, buttons, 'camp');
    expect(layout.dataset.sidebarTab).toBe('camp');
    expect(buttons.map(item => [...item.classes])).toEqual([[], [], ['active']]);
    expect(buttons.map(item => item.attributes.get('aria-selected'))).toEqual(['false', 'false', 'true']);
  });

  it('opens the remembered tab, switches on click, and remembers the new one', () => {
    const layout = { dataset: {} as DOMStringMap };
    const buttons = ['bag', 'build', 'camp'].map(button);
    const root = { querySelector: () => layout, querySelectorAll: () => buttons };
    const storage = memory();
    saveSidebarTab(storage, 'bag');
    wireSidebarTabs(root, storage);
    expect(layout.dataset.sidebarTab).toBe('bag');
    buttons[2].click?.();
    expect(layout.dataset.sidebarTab).toBe('camp');
    expect(loadSidebarTab(storage)).toBe('camp');
  });

  it('does nothing on a page without the game layout', () => {
    const buttons = ['bag'].map(button);
    expect(() => wireSidebarTabs({ querySelector: () => null, querySelectorAll: () => buttons }, memory())).not.toThrow();
    expect(buttons[0].click).toBeUndefined();
  });
});

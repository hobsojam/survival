import { describe, expect, it } from 'vitest';
import { gateTap, nextOpenTab, sidebarTab } from '../src/ui/dock';

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

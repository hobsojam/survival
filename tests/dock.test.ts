import { describe, expect, it } from 'vitest';
import { nextOpenTab } from '../src/ui/dock';

describe('phone dock tabs', () => {
  it('opens a tab, closes it on a second tap, and switches between tabs', () => {
    expect(nextOpenTab(null, 'bag')).toBe('bag');
    expect(nextOpenTab('bag', 'bag')).toBeNull();
    expect(nextOpenTab('bag', 'build')).toBe('build');
  });
});

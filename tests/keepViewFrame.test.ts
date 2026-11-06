import { describe, expect, it } from 'vitest';
import styles from '../src/style.css?raw';
import { revealFrame } from '../src/ui/keepViewFrame';

function frameAt(top: number, height: number) {
  const asked: ScrollIntoViewOptions[] = [];
  return { asked, getBoundingClientRect: () => ({ top, bottom: top + height, height }), scrollIntoView: (options: ScrollIntoViewOptions) => { asked.push(options); } };
}

describe('bringing the view into sight', () => {
  it('leaves a frame alone that is already in sight', () => {
    const frame = frameAt(50, 600);
    revealFrame(frame, 844);
    expect(frame.asked).toEqual([]);
  });

  it('shows the bottom of a frame taller than the window, where the camp and the line are', () => {
    const frame = frameAt(101, 479);
    revealFrame(frame, 390);
    expect(frame.asked).toEqual([{ block: 'end' }]);
  });

  it('scrolls a frame that would fit but is partly out of sight', () => {
    const frame = frameAt(400, 300);
    revealFrame(frame, 600);
    expect(frame.asked).toEqual([{ block: 'nearest' }]);
  });
});

describe('the frost', () => {
  it('stays off the view from the keep, and comes straight back afterwards', () => {
    const css = styles.replace(/\s+/g, ' ');
    expect(css).toContain('.keep-view .game-frame::after { opacity: 0; transition: none; }');
  });
});

describe('messages on a phone', () => {
  it('are not hidden wholesale over the view, so a save failure can still be seen', () => {
    expect(styles.replace(/\s+/g, ' ')).not.toContain('.keep-view .message.toast');
  });
});

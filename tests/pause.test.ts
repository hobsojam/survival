import { describe, expect, it } from 'vitest';
import { PauseControl, isPauseKey, nextPaused, pauseButtonView, createPause, renderPause, wirePause, type PausePage } from '../src/ui/pause';
import { Soundscape } from '../src/game/soundscape';

describe('pausing', () => {
  const playing = { started: true, endingShown: false };

  it('toggles while a game is running', () => {
    expect(nextPaused(false, playing)).toBe(true);
    expect(nextPaused(true, playing)).toBe(false);
  });

  it('stays unpaused before a game starts and during the lookout ending', () => {
    expect(nextPaused(false, { started: false, endingShown: false })).toBe(false);
    expect(nextPaused(false, { started: true, endingShown: true })).toBe(false);
  });

  it('pauses on Esc, once per press', () => {
    expect(isPauseKey({ key: 'Escape', repeat: false })).toBe(true);
    expect(isPauseKey({ key: 'Escape', repeat: true })).toBe(false);
    expect(isPauseKey({ key: 'p', repeat: false })).toBe(false);
  });

  it('labels the button for what it will do', () => {
    expect(pauseButtonView(false)).toEqual({ icon: '❚❚', label: 'Pause', title: 'Pause the game (Esc)', pressed: 'false' });
    expect(pauseButtonView(true)).toEqual({ icon: '▶', label: 'Resume', title: 'Resume the game (Esc)', pressed: 'true' });
  });
});

describe('the pause control', () => {
  function control(game = { started: true, endingShown: false }) {
    const calls: string[] = [];
    const pause = new PauseControl({
      holdGame: paused => calls.push(`hold ${paused}`),
      save: () => calls.push('save'),
      sound: paused => calls.push(`sound ${paused}`),
      show: view => calls.push(`show ${view.label}`)
    }, () => game);
    return { pause, calls };
  }

  it('holds the game, saves, silences the sound and shows Resume when paused', () => {
    const { pause, calls } = control();
    pause.toggle();
    expect(pause.paused).toBe(true);
    expect(calls).toEqual(['hold true', 'save', 'sound true', 'show Resume']);
  });

  it('lets everything go again on resume, without saving', () => {
    const { pause, calls } = control();
    pause.toggle();
    calls.length = 0;
    pause.toggle();
    expect(pause.paused).toBe(false);
    expect(calls).toEqual(['hold false', 'sound false', 'show Pause']);
  });

  it('does nothing when already in the asked-for state, or when pausing is not allowed', () => {
    const { pause, calls } = control({ started: false, endingShown: false });
    pause.set(false);
    pause.toggle();
    expect(calls).toEqual([]);
  });

  it('answers Esc and ignores other keys', () => {
    const { pause } = control();
    expect(pause.handleKey({ key: 'a', repeat: false })).toBe(false);
    expect(pause.paused).toBe(false);
    expect(pause.handleKey({ key: 'Escape', repeat: false })).toBe(true);
    expect(pause.paused).toBe(true);
  });
});

describe('the pause button and card', () => {
  function page() {
    const text = (value: string) => ({ textContent: value });
    const icon = text('❚❚');
    const label = text('Pause');
    const attributes = new Map<string, string>();
    const listeners = new Map<string, () => void>();
    const button = { title: '', querySelector: (selector: string) => (selector === '.pause-icon' ? icon : label),
      setAttribute: (name: string, value: string) => { attributes.set(name, value); },
      addEventListener: (_type: 'click', listener: () => void) => { listeners.set('toggle', listener); } };
    const resume = { addEventListener: (_type: 'click', listener: () => void) => { listeners.set('resume', listener); } };
    const overlay = { hidden: true };
    const elements: Record<string, unknown> = { '#pause-toggle': button, '#pause-resume': resume, '#pause-overlay': overlay };
    // One lookup stands in for the page's overloaded querySelector.
    const root = { querySelector: (selector: string) => elements[selector] ?? null } as unknown as PausePage;
    return { root, icon, label, attributes, listeners, button, overlay };
  }

  it('shows the paused card and a Resume button, then puts them back', () => {
    const view = page();
    renderPause(view.root, pauseButtonView(true), true);
    expect([view.icon.textContent, view.label.textContent, view.button.title, view.attributes.get('aria-pressed'), view.overlay.hidden])
      .toEqual(['▶', 'Resume', 'Resume the game (Esc)', 'true', false]);
    renderPause(view.root, pauseButtonView(false), false);
    expect([view.label.textContent, view.overlay.hidden]).toEqual(['Pause', true]);
  });

  it('skips anything missing from the page', () => {
    const bare = { querySelector: () => null } as unknown as PausePage;
    expect(() => renderPause(bare, pauseButtonView(true), true)).not.toThrow();
    const view = page();
    view.button.querySelector = () => null as never;
    renderPause(view.root, pauseButtonView(true), true);
    expect([view.button.title, view.overlay.hidden]).toEqual(['Resume the game (Esc)', false]);
  });

  it('pauses from the top button, resumes from the card, and answers Esc', () => {
    const view = page();
    let keydown: ((event: { key: string; repeat: boolean; preventDefault(): void }) => void) | undefined;
    const doc = { addEventListener: (_type: 'keydown', listener: typeof keydown) => { keydown = listener; } };
    const pause = new PauseControl({ holdGame: () => undefined, save: () => undefined, sound: () => undefined, show: () => undefined }, () => ({ started: true, endingShown: false }));
    wirePause(view.root, doc, pause);
    view.listeners.get('toggle')?.();
    expect(pause.paused).toBe(true);
    view.listeners.get('resume')?.();
    expect(pause.paused).toBe(false);
    let prevented = false;
    keydown?.({ key: 'Escape', repeat: false, preventDefault: () => { prevented = true; } });
    expect([pause.paused, prevented]).toEqual([true, true]);
    prevented = false;
    keydown?.({ key: 'w', repeat: false, preventDefault: () => { prevented = true; } });
    expect([pause.paused, prevented]).toEqual([true, false]);
  });
});

describe('building the pause control for the page', () => {
  function setup(endingShown = false) {
    const calls: string[] = [];
    const overlay = { hidden: true };
    const ending = { classList: { contains: (name: string) => name === 'hidden' && !endingShown } };
    const elements: Record<string, unknown> = { '#pause-overlay': overlay, '#lookout-ending': ending };
    const page = { querySelector: (selector: string) => elements[selector] ?? null } as unknown as Parameters<typeof createPause>[0];
    const pause = createPause(page, {
      scenes: () => ({ pause: key => calls.push(`pause ${key}`), resume: key => calls.push(`resume ${key}`) }),
      sound: { setPaused: paused => calls.push(`sound ${paused}`) },
      save: () => calls.push('save'),
      started: () => true
    });
    return { pause, calls, overlay };
  }

  it('pauses the game scene, saves, silences the sound and shows the card', () => {
    const { pause, calls, overlay } = setup();
    pause.toggle();
    expect(calls).toEqual(['pause GameScene', 'save', 'sound true']);
    expect(overlay.hidden).toBe(false);
    pause.toggle();
    expect(calls.slice(3)).toEqual(['resume GameScene', 'sound false']);
    expect(overlay.hidden).toBe(true);
  });

  it('will not pause over the lookout ending', () => {
    const { pause, calls } = setup(true);
    pause.toggle();
    expect([pause.paused, calls]).toEqual([false, []]);
  });
});

describe('pausing the sound', () => {
  it('is harmless before any audio has started', () => {
    const sound = new Soundscape();
    expect(() => { sound.setPaused(true); sound.resume(); sound.setPaused(false); }).not.toThrow();
    expect(sound.isMuted).toBe(false);
  });
});

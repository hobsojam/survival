/** Pausing needs a running game, and the lookout ending already holds the game still. */
export function nextPaused(paused: boolean, game: { started: boolean; endingShown: boolean }): boolean {
  if (!game.started || game.endingShown) return false;
  return !paused;
}

/** Esc pauses and resumes; holding it down doesn't flicker between the two. */
export function isPauseKey(event: { key: string; repeat: boolean }): boolean {
  return event.key === 'Escape' && !event.repeat;
}

export function pauseButtonView(paused: boolean): { icon: string; label: string; title: string; pressed: 'true' | 'false' } {
  return paused
    ? { icon: '▶', label: 'Resume', title: 'Resume the game (Esc)', pressed: 'true' }
    : { icon: '❚❚', label: 'Pause', title: 'Pause the game (Esc)', pressed: 'false' };
}

export interface PauseEffects {
  /** Stops or restarts the scene: its clock, movement and input. */
  holdGame(paused: boolean): void;
  save(): void;
  sound(paused: boolean): void;
  show(view: ReturnType<typeof pauseButtonView>, paused: boolean): void;
}

/** Whether the game is paused, and everything that has to change with it. */
export class PauseControl {
  paused = false;

  constructor(private readonly effects: PauseEffects, private readonly game: () => { started: boolean; endingShown: boolean }) {}

  toggle(): void {
    this.set(nextPaused(this.paused, this.game()));
  }

  set(paused: boolean): void {
    if (paused === this.paused) return;
    this.paused = paused;
    this.effects.holdGame(paused);
    if (paused) this.effects.save();
    this.effects.sound(paused);
    this.effects.show(pauseButtonView(paused), paused);
  }

  /** Toggles on Esc; reports whether the key was used, so the page can stop its default. */
  handleKey(event: { key: string; repeat: boolean }): boolean {
    if (!isPauseKey(event)) return false;
    this.toggle();
    return true;
  }
}

interface Clickable {
  addEventListener(type: 'click', listener: () => void): void;
}

interface PauseButton extends Clickable {
  title: string;
  querySelector(selector: '.pause-icon' | '.pause-label'): { textContent: string | null } | null;
  setAttribute(name: string, value: string): void;
}

/** The parts of the page the pause button, card and key use. */
export interface PausePage {
  querySelector(selector: '#pause-toggle'): PauseButton | null;
  querySelector(selector: '#pause-resume'): Clickable | null;
  querySelector(selector: '#pause-overlay'): { hidden: boolean } | null;
}

/** Shows the button for what it will do next, and the paused card over the game while paused. */
export function renderPause(page: PausePage, view: ReturnType<typeof pauseButtonView>, paused: boolean): void {
  const button = page.querySelector('#pause-toggle');
  if (button) {
    const icon = button.querySelector('.pause-icon');
    const label = button.querySelector('.pause-label');
    if (icon) icon.textContent = view.icon;
    if (label) label.textContent = view.label;
    button.title = view.title;
    button.setAttribute('aria-pressed', view.pressed);
  }
  const overlay = page.querySelector('#pause-overlay');
  if (overlay) overlay.hidden = !paused;
}

/** The pause control for the game page: it pauses the game scene and its sound, saves, and reads the lookout ending off the page. */
export function createPause(
  page: PausePage & { querySelector(selector: '#lookout-ending'): { classList: { contains(name: string): boolean } } | null },
  deps: {
    scenes: () => { pause(key: string): void; resume(key: string): void } | undefined;
    sound: { setPaused(paused: boolean): void };
    save(): void;
    started(): boolean;
  }
): PauseControl {
  return new PauseControl({
    holdGame: paused => { if (paused) deps.scenes()?.pause('GameScene'); else deps.scenes()?.resume('GameScene'); },
    save: () => deps.save(),
    sound: paused => deps.sound.setPaused(paused),
    show: (view, paused) => renderPause(page, view, paused)
  }, () => ({ started: deps.started(), endingShown: page.querySelector('#lookout-ending')?.classList.contains('hidden') === false }));
}

/** The top button and the card's Resume both toggle; Esc toggles from anywhere on the page. */
export function wirePause(
  page: PausePage,
  doc: { addEventListener(type: 'keydown', listener: (event: { key: string; repeat: boolean; preventDefault(): void }) => void): void },
  pause: PauseControl
): void {
  page.querySelector('#pause-toggle')?.addEventListener('click', () => pause.toggle());
  page.querySelector('#pause-resume')?.addEventListener('click', () => pause.toggle());
  doc.addEventListener('keydown', event => { if (pause.handleKey(event)) event.preventDefault(); });
}

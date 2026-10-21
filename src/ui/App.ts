import Phaser from 'phaser';
import { BALANCE, createGame, type GameState, type StructureId } from '../game/state';
import { GameScene } from '../scene/GameScene';
import { loadGame, saveGame, type LoadResult } from '../game/save';
import { isAtCamp } from '../game/rules';

const buildOptions: { id: StructureId; name: string; description: string }[] = [
  { id: 'shelter', name: 'Shelter', description: 'A roof against the night cold' },
  { id: 'bed', name: 'Bed', description: 'Rest more deeply at camp' },
  { id: 'crate', name: 'Storage crate', description: 'Carry up to 16 supplies' }
];

export class App {
  private state: GameState;
  private scene?: GameScene;
  private game?: Phaser.Game;
  private readonly root: HTMLElement;
  private storage?: Storage;
  private previousSave: LoadResult = { kind: 'empty' };
  private lastSaveAt = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    this.state = createGame();
    try {
      this.storage = window.localStorage;
      this.previousSave = loadGame(this.storage);
    } catch (error) {
      this.previousSave = { kind: 'invalid', reason: `Browser storage is unavailable: ${String(error)}` };
    }
    this.root.innerHTML = `
      <div class="shell">
        <header class="topbar">
          <div class="brand"><span class="brand-icon">✦</span><div><strong>Hearthwild</strong><small>A little place to begin again</small></div></div>
          <div class="top-actions"><span id="save-status" class="save-status">Local save</span><button id="restart-game" class="restart-button" hidden>New game</button><div class="day-pill" id="day-pill">Day 1 · Morning</div></div>
        </header>
        <div class="layout">
          <main class="game-panel">
            <div class="game-frame"><div id="game-canvas"></div><div class="prompt" id="prompt">WASD / arrows  Move</div></div>
            <div class="message" id="message">Gather a few branches. Your camp is waiting.</div>
            <div class="shortcuts"><span><kbd>WASD</kbd> Move</span><span><kbd>E</kbd> Gather</span><span><kbd>F</kbd> Fire</span><span><kbd>R</kbd> Rest</span><span><kbd>Q</kbd> Eat</span></div>
          </main>
          <aside class="sidebar">
            <section class="panel"><p class="eyebrow">YOUR SURVIVOR</p><h2>Take it one day at a time</h2>
              <div class="meter"><div class="meter-title"><span>Energy</span><b id="energy-value">100</b></div><div class="track"><div id="energy-bar" class="fill energy"></div></div></div>
              <div class="meter"><div class="meter-title"><span>Hunger</span><b id="hunger-value">100</b></div><div class="track"><div id="hunger-bar" class="fill hunger"></div></div></div>
              <div class="meter"><div class="meter-title"><span>Warmth</span><b id="warmth-value">100</b></div><div class="track"><div id="warmth-bar" class="fill warmth"></div></div></div>
              <div class="quick-actions"><button data-action="eat">Eat berries</button><button data-action="rest">Rest</button><button data-action="stokeFire">Feed fire</button></div>
            </section>
            <section class="panel"><p class="eyebrow">IN YOUR BAG</p><div class="supplies"><div><span class="supply-icon wood">▰</span><strong id="wood-count">0</strong><small>Wood</small></div><div><span class="supply-icon food">●</span><strong id="food-count">0</strong><small>Food</small></div><div><span class="supply-icon space">◫</span><strong id="space-count">0/8</strong><small>Carried</small></div></div><div class="fire-status" id="fire-status">The fire is unlit</div></section>
            <section class="panel build-panel"><p class="eyebrow">MAKE CAMP HOME</p><h2>Little improvements</h2><p id="build-hint" class="build-hint">Stand inside the marked camp circle to build.</p><div id="build-list"></div></section>
          </aside>
        </div>
        <div id="start-screen" class="start-screen"><div class="start-card"><div class="start-mark">✦</div><p class="eyebrow">A SMALL SURVIVAL STORY</p><h1>Make a little place<br>feel like home.</h1><p class="start-copy">Gather what you need, keep a fire glowing, and build a refuge one day at a time.</p><p id="start-note" class="start-note"></p><div class="start-buttons"><button id="continue-game" class="primary-button" hidden>Continue your camp</button><button id="new-game" class="secondary-button">Start a new game</button></div><small>Single player · Saves in this browser</small></div></div>
      </div>`;
    this.root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => {
      button.addEventListener('click', () => {
        const type = button.dataset.action as 'eat' | 'rest' | 'stokeFire';
        this.scene?.perform({ type });
      });
    });
    this.root.querySelector('#build-list')!.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-build]');
      if (button) this.scene?.perform({ type: 'build', structureId: button.dataset.build as StructureId });
    });
    this.root.querySelector('#new-game')!.addEventListener('click', () => this.beginNewGame());
    this.root.querySelector('#continue-game')!.addEventListener('click', () => this.continueGame());
    this.root.querySelector('#restart-game')!.addEventListener('click', () => this.beginNewGame());
    window.addEventListener('pagehide', () => { if (this.scene) this.saveCurrent(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.scene) this.saveCurrent(); });
    this.showStartScreen();
    this.render();
  }

  startGame(state: GameState): void {
    this.game?.destroy(true);
    this.root.querySelector('#start-screen')?.classList.add('hidden');
    const restart = this.root.querySelector<HTMLButtonElement>('#restart-game');
    if (restart) restart.hidden = false;
    this.state = state;
    this.lastSaveAt = Date.now();
    this.scene = new GameScene(state, (next, cause) => {
      const previous = this.state;
      this.state = next;
      this.render();
      if ((cause === 'action' && next !== previous) || Date.now() - this.lastSaveAt >= 10000) this.saveCurrent();
    }, message => this.setMessage(message));
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'game-canvas',
      width: 960,
      height: 600,
      backgroundColor: '#456a59',
      scene: [this.scene],
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 960, height: 600 }
    });
    this.render();
  }

  private showStartScreen(): void {
    const note = this.root.querySelector<HTMLElement>('#start-note');
    const continueButton = this.root.querySelector<HTMLButtonElement>('#continue-game');
    if (continueButton) continueButton.hidden = this.previousSave.kind !== 'loaded';
    if (note) note.textContent = this.previousSave.kind === 'loaded'
      ? `Your camp is waiting on day ${this.previousSave.state.day}.`
      : this.previousSave.kind === 'invalid'
        ? `Your existing save could not be loaded: ${this.previousSave.reason}`
        : 'A fresh camp is ready whenever you are.';
  }

  private beginNewGame(): void {
    if (this.previousSave.kind !== 'empty' && !window.confirm('Start a new game? Your existing local save will be replaced.')) return;
    this.startGame(createGame());
    this.setMessage('Gather a few branches. Your camp is waiting.');
    this.saveCurrent();
  }

  private continueGame(): void {
    if (this.previousSave.kind !== 'loaded') return;
    this.startGame(this.previousSave.state);
    this.setMessage('Welcome back to your camp.');
    this.setText('save-status', 'Loaded locally');
  }

  private saveCurrent(): void {
    this.state = this.scene?.getState() ?? this.state;
    if (!this.storage) {
      this.setText('save-status', 'Saving unavailable');
      this.setMessage('Browser storage is unavailable; progress will be lost when you close this page.');
      return;
    }
    const result = saveGame(this.storage, this.state);
    if (result.ok) {
      this.previousSave = { kind: 'loaded', state: this.state };
      this.lastSaveAt = Date.now();
      this.setText('save-status', 'Saved locally');
    } else {
      this.setText('save-status', 'Save failed');
      this.setMessage(`Could not save locally: ${result.error}`);
    }
  }

  getState(): GameState { return this.state; }

  setMessage(message: string): void {
    const element = this.root.querySelector<HTMLElement>('#message');
    if (element) element.textContent = message;
  }

  private render(): void {
    const { player, inventory, structures } = this.state;
    const phase = this.state.timeOfDay >= BALANCE.nightStart ? 'Night' : this.state.timeOfDay >= 110 ? 'Afternoon' : 'Morning';
    this.setText('day-pill', `Day ${this.state.day} · ${phase}`);
    for (const key of ['energy', 'hunger', 'warmth'] as const) {
      const value = Math.round(player[key]);
      this.setText(`${key}-value`, String(value));
      const bar = this.root.querySelector<HTMLElement>(`#${key}-bar`);
      if (bar) bar.style.width = `${value}%`;
    }
    this.setText('wood-count', String(inventory.wood));
    this.setText('food-count', String(inventory.food));
    this.setText('space-count', `${inventory.wood + inventory.food}/${structures.crate ? BALANCE.crateCapacity : BALANCE.baseCapacity}`);
    this.setText('fire-status', this.state.fireFuel > 0 ? `Fire burning · ${Math.ceil(this.state.fireFuel)}s of warmth` : 'The fire is unlit');
    this.setText('prompt', this.scene?.getPrompt() ?? 'WASD / arrows  Move');
    this.setText('build-hint', isAtCamp(this.state) ? 'At camp — click an upgrade to build.' : 'Stand inside the marked camp circle to build.');
    this.root.querySelector('#build-list')!.innerHTML = buildOptions.map(({ id, name, description }) => {
      const built = this.state.structures[id];
      const cost = BALANCE.buildCosts[id];
      return `<button class="build-item ${built ? 'built' : ''}" data-build="${id}" ${built ? 'disabled' : ''}><span class="build-symbol">${id === 'shelter' ? '⌂' : id === 'bed' ? '▣' : '▤'}</span><span class="build-copy"><strong>${name}</strong><small>${description}</small></span><span class="build-cost">${built ? 'Built' : `${cost} wood`}</span></button>`;
    }).join('');
  }

  private setText(id: string, text: string): void {
    const element = this.root.querySelector<HTMLElement>(`#${id}`);
    if (element) element.textContent = text;
  }
}

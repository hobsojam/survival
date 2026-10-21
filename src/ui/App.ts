import Phaser from 'phaser';
import { BALANCE, BUILDINGS, createGame, type GameState, type StructureId } from '../game/state';
import { GameScene } from '../scene/GameScene';
import { displayScale, LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../scene/pixelScale';
import { loadGame, saveGame, type LoadResult } from '../game/save';
import { isAtCamp, isColdNight, sleepBlocker } from '../game/rules';
import { dayPhase, formatClock, nextChange } from '../game/clock';

const buildOptions = Object.keys(BUILDINGS) as StructureId[];

export class App {
  private state: GameState;
  private scene?: GameScene;
  private game?: Phaser.Game;
  private gameResize?: ResizeObserver;
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
    const buildMarkup = buildOptions.map(id => {
      const { name, description, symbol } = BUILDINGS[id];
      return `<button type="button" class="build-item" data-build="${id}"><span class="build-symbol">${symbol}</span><span class="build-copy"><strong>${name}</strong><small>${description}</small></span><span class="build-cost"><b class="build-verb">Build</b><small class="build-price"></small></span></button>`;
    }).join('');
    this.root.innerHTML = `
      <div class="shell">
        <header class="topbar">
          <div class="brand"><span class="brand-icon">✦</span><div><strong>Hearthwild</strong><small>A little place to begin again</small></div></div>
          <div class="top-actions"><span id="save-status" class="save-status">Local save</span><button id="restart-game" class="restart-button" hidden>New game</button><div class="day-pill" id="day-pill"><span id="day-label">Day 1 · Morning</span><span class="day-dial" aria-hidden="true"><span class="day-dial-night" style="left: ${BALANCE.nightStart / BALANCE.daySeconds * 100}%"></span><span id="day-dial-hand" class="day-dial-hand"></span></span><span id="day-countdown" class="day-countdown"></span></div></div>
        </header>
        <div class="layout">
          <main class="game-panel">
            <div class="game-frame"><div id="game-canvas"></div><div class="prompt" id="prompt">WASD / arrows  Move</div></div>
            <div class="message" id="message">Gather a few branches. Your camp is waiting.</div>
            <div class="shortcuts"><span><kbd>WASD</kbd> Move</span><span><kbd>E</kbd> Gather</span><span><kbd>F</kbd> Fire</span><span><kbd>R</kbd> Rest</span><span><kbd>Q</kbd> Eat</span><span><kbd>C</kbd> Cook</span><span><kbd>G</kbd> Stargaze</span><span><kbd>Z</kbd> Sleep</span></div>
          </main>
          <aside class="sidebar">
            <section class="panel forecast-panel" id="forecast-panel"><p class="eyebrow">THE FORECAST</p><h2 id="forecast-title">A cold front is coming</h2><p id="forecast-copy" class="forecast-copy"></p><div class="forecast-checks"><span id="forecast-shelter"></span><span id="forecast-fire"></span></div></section>
            <section class="panel"><p class="eyebrow">YOUR SURVIVOR</p><h2>Take it one day at a time</h2>
              <div class="meter"><div class="meter-title"><span>Energy</span><b id="energy-value">100</b></div><div class="track"><div id="energy-bar" class="fill energy"></div></div></div>
              <div class="meter"><div class="meter-title"><span>Hunger</span><b id="hunger-value">100</b></div><div class="track"><div id="hunger-bar" class="fill hunger"></div></div></div>
              <div class="meter"><div class="meter-title"><span>Warmth</span><b id="warmth-value">100</b></div><div class="track"><div id="warmth-bar" class="fill warmth"></div></div></div>
              <div class="quick-actions"><button data-action="eat">Eat berries</button><button data-action="rest">Rest</button><button data-action="stokeFire">Feed fire</button><button data-action="sleep" id="sleep-button">Sleep</button></div>
            </section>
            <section class="panel"><p class="eyebrow">IN YOUR BAG</p><div class="supplies"><div><span class="supply-icon wood">▰</span><strong id="wood-count">0</strong><small>Wood</small></div><div><span class="supply-icon food">●</span><strong id="food-count">0</strong><small>Food</small></div><div><span class="supply-icon fiber">≋</span><strong id="fiber-count">0</strong><small>Fiber</small></div><div><span class="supply-icon space">◫</span><strong id="space-count">0/8</strong><small>Carried</small></div></div><div class="fire-status" id="fire-status">The fire is unlit</div></section>
            <section class="panel night-panel"><p class="eyebrow">AFTER DARK</p><h2>A little time for yourself</h2><p class="night-hint" id="night-hint">These small moments are waiting for nightfall.</p><div class="night-actions"><button type="button" data-action="cook" id="cook-button"><span>♨</span><strong>Cook a berry</strong><small>1 berry · 8 seconds</small></button><button type="button" data-action="stargaze" id="stargaze-button"><span>✦</span><strong>Watch the stars</strong><small>12 seconds · a little rest</small></button></div></section>
            <section class="panel build-panel"><p class="eyebrow">MAKE CAMP HOME</p><h2>Little improvements</h2><p id="build-hint" class="build-hint">Stand inside the marked camp circle to build.</p><div id="build-list">${buildMarkup}</div></section>
          </aside>
        </div>
        <div id="start-screen" class="start-screen"><div class="start-card"><div class="start-mark">✦</div><p class="eyebrow">A SMALL SURVIVAL STORY</p><h1>Make a little place<br>feel like home.</h1><p class="start-copy">Gather what you need, keep a fire glowing, and build a refuge one day at a time.</p><p id="start-note" class="start-note"></p><div class="start-buttons"><button id="continue-game" class="primary-button" hidden>Continue your camp</button><button id="new-game" class="secondary-button">Start a new game</button></div><small>Single player · Saves in this browser</small></div></div>
      </div>`;
    this.root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => {
      button.addEventListener('click', () => {
        const type = button.dataset.action as 'eat' | 'rest' | 'stokeFire' | 'sleep' | 'cook' | 'stargaze';
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
    this.gameResize?.disconnect();
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
      width: LOGICAL_WIDTH,
      height: LOGICAL_HEIGHT,
      pixelArt: true,
      roundPixels: true,
      antialias: false,
      backgroundColor: '#456a59',
      scene: [this.scene],
      scale: { mode: Phaser.Scale.NONE, width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT }
    });
    const frame = this.root.querySelector<HTMLElement>('.game-frame')!;
    const fitCanvas = () => {
      if (!this.game?.canvas) return;
      const scale = displayScale(frame.clientWidth, frame.clientHeight);
      if (this.game.scale.zoom !== scale) this.game.scale.setZoom(scale);
      else this.game.scale.refresh();
    };
    this.gameResize = new ResizeObserver(fitCanvas);
    this.gameResize.observe(frame);
    fitCanvas();
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
    const { timeOfDay } = this.state;
    const phase = dayPhase(timeOfDay);
    const change = nextChange(timeOfDay);
    this.setText('day-label', `Day ${this.state.day} · ${phase}`);
    this.setText('day-countdown', `${change.event} in ${formatClock(change.seconds)}`);
    this.root.querySelector('#day-pill')?.classList.toggle('night', phase === 'Night');
    const hand = this.root.querySelector<HTMLElement>('#day-dial-hand');
    if (hand) hand.style.left = `${timeOfDay / BALANCE.daySeconds * 100}%`;
    this.root.querySelector('#sleep-button')?.classList.toggle('ready', !sleepBlocker(this.state));
    for (const key of ['energy', 'hunger', 'warmth'] as const) {
      const value = Math.round(player[key]);
      this.setText(`${key}-value`, String(value));
      const bar = this.root.querySelector<HTMLElement>(`#${key}-bar`);
      if (bar) bar.style.width = `${value}%`;
    }
    this.setText('wood-count', String(inventory.wood));
    this.setText('food-count', String(inventory.food));
    this.setText('fiber-count', String(inventory.fiber));
    this.setText('space-count', `${inventory.wood + inventory.food + inventory.fiber}/${structures.crate ? BALANCE.crateCapacity : BALANCE.baseCapacity}`);
    this.setText('fire-status', this.state.fireFuel > 0 ? `Fire burning · ${Math.ceil(this.state.fireFuel)}s of warmth` : 'The fire is unlit');
    const atCamp = isAtCamp(this.state);
    const afterDark = timeOfDay >= BALANCE.nightStart;
    this.setText('night-hint', !afterDark ? 'These small moments are waiting for nightfall.'
      : !atCamp ? 'Return to the camp circle for a quiet evening.'
        : 'Optional comforts while the night passes.');
    this.root.querySelector('#cook-button')?.classList.toggle('ready', afterDark && atCamp && inventory.food > 0 && this.state.fireFuel > 0);
    this.root.querySelector('#stargaze-button')?.classList.toggle('ready', afterDark && atCamp);
    const storm = isColdNight(this.state);
    const forecast = this.root.querySelector('#forecast-panel');
    forecast?.classList.toggle('active', storm);
    forecast?.classList.toggle('weathered', this.state.progress.hearthUnlocked);
    if (this.state.progress.hearthUnlocked) {
      this.setText('forecast-title', 'The cold night is behind you');
      this.setText('forecast-copy', 'You kept your camp warm through dawn. The stone hearth is ready to build.');
      this.setText('forecast-shelter', '✓ Shelter held firm');
      this.setText('forecast-fire', '✓ Hearth unlocked');
    } else {
      const day = this.state.progress.nextStormDay!;
      const needed = storm ? Math.ceil((BALANCE.daySeconds - timeOfDay) * BALANCE.coldNightFireBurn) : (BALANCE.daySeconds - BALANCE.nightStart) * BALANCE.coldNightFireBurn;
      this.setText('forecast-title', storm ? 'The cold front is here' : `Cold front · day ${day} night`);
      this.setText('forecast-copy', storm ? 'Stay at camp and keep the fire alive until dawn.' : `Build a shelter and bring two logs to camp before nightfall on day ${day}.`);
      this.setText('forecast-shelter', `${structures.shelter ? '✓' : '○'} Shelter ${structures.shelter ? 'ready' : 'needed'}`);
      this.setText('forecast-fire', `${this.state.fireFuel > needed ? '✓' : '○'} Fire: ${Math.ceil(this.state.fireFuel)} / ${needed}s ${storm ? 'to dawn' : 'for the night'}`);
    }
    this.setText('prompt', this.scene?.getPrompt() ?? 'WASD / arrows  Move');
    this.setText('build-hint', isAtCamp(this.state) ? 'At camp — click an upgrade to build.' : 'Stand inside the marked camp circle to build.');
    for (const id of buildOptions) {
      const built = this.state.structures[id];
      const definition = BUILDINGS[id];
      const locked = definition.prerequisite === 'coldNight' && !this.state.progress.hearthUnlocked;
      const needsShelter = definition.prerequisite === 'shelter' && !structures.shelter;
      const cost = definition.cost;
      const button = this.root.querySelector<HTMLButtonElement>(`[data-build="${id}"]`)!;
      button.disabled = built || locked;
      button.classList.toggle('built', built);
      button.classList.toggle('locked', locked);
      button.classList.toggle('ready', !built && !locked && !needsShelter && isAtCamp(this.state) && inventory.wood >= cost.wood && inventory.fiber >= cost.fiber);
      const fiberPrice = cost.fiber ? ` · ${cost.fiber} fiber` : '';
      let verb = 'Build';
      let price = `${cost.wood} wood${fiberPrice}`;
      if (built) {
        verb = 'Built';
        price = 'Complete';
      } else if (locked) {
        verb = 'Locked';
        price = 'Weather cold night';
      }
      button.querySelector<HTMLElement>('.build-verb')!.textContent = verb;
      button.querySelector<HTMLElement>('.build-price')!.textContent = price;
    }
  }

  private setText(id: string, text: string): void {
    const element = this.root.querySelector<HTMLElement>(`#${id}`);
    if (element) element.textContent = text;
  }
}

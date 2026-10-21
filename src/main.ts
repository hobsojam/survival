import './style.css';
import { createGame } from './game/state';

const game = createGame();
const app = document.querySelector<HTMLDivElement>('#app');
if (app) app.textContent = `Cozy Survival — Day ${game.day}`;

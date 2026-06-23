import './styles.css';
import { Game } from './game/Game';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const overlay = document.getElementById('overlay') as HTMLElement;

// brief boot notice while creature textures are keyed
const loader = document.createElement('div');
loader.className = 'panel';
loader.innerHTML = `<div class="subtitle">F6 FACILITY</div><div class="keyhint">initialising containment…</div>`;

async function boot(): Promise<void> {
  // clear any prior UI (e.g. on a hot reload) so overlays never stack
  overlay.replaceChildren(loader);
  try {
    const game = new Game(canvas, overlay);
    await game.init();
  } catch (err) {
    console.error('[F6] failed to start', err);
    loader.innerHTML = `<div class="title" style="font-size:42px;color:var(--blood-bright)">SIGNAL LOST</div>
      <div class="keyhint">This game needs a WebGL-capable browser.<br/>${String(err)}</div>`;
    return;
  }
  loader.remove();
}

void boot();

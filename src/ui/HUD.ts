import { el, sleep } from './dom';
import type { RunState } from '../game/RunState';

/** In-run heads-up display + the full-screen fear overlays (vignette, sanity
 *  bleed, stinger flash) and the black fade used on floor transitions. */
export class HUD {
  private root: HTMLDivElement;
  private sanityFill: HTMLDivElement;
  private powerFill: HTMLDivElement;
  private scoreEl: HTMLDivElement;
  private depthEl: HTMLDivElement;
  private promptEl: HTMLDivElement;
  private sanityFx: HTMLDivElement;
  private flashFx: HTMLDivElement;
  private cover: HTMLDivElement;
  private pause: HTMLDivElement;

  constructor(parent: HTMLElement) {
    parent.appendChild(el('div', 'fx-scanlines'));
    parent.appendChild(el('div', 'fx-vignette'));
    this.sanityFx = el('div', 'fx-sanity');
    parent.appendChild(this.sanityFx);
    this.flashFx = el('div', 'fx-flash');
    this.flashFx.style.transition = 'opacity .28s ease-out';
    parent.appendChild(this.flashFx);

    this.cover = el('div');
    Object.assign(this.cover.style, {
      position: 'fixed', inset: '0', background: '#000', zIndex: '30',
      opacity: '0', pointerEvents: 'none', transition: 'opacity .3s ease',
    } as CSSStyleDeclaration);
    parent.appendChild(this.cover);

    this.root = el('div', 'hud');
    this.root.innerHTML = `
      <div class="meters">
        <div class="meter sanity"><div class="label"><span>SANITY</span></div><div class="track"><div class="fill"></div></div></div>
        <div class="meter power"><div class="label"><span>POWER</span></div><div class="track"><div class="fill"></div></div></div>
      </div>
      <div class="readout">
        <div class="label">SCORE</div>
        <div class="score">0</div>
        <div class="depth">SUBLEVEL 1</div>
      </div>
      <div class="crosshair"></div>
      <div class="prompt"></div>`;
    parent.appendChild(this.root);

    this.sanityFill = this.root.querySelector('.meter.sanity .fill')!;
    this.powerFill = this.root.querySelector('.meter.power .fill')!;
    this.scoreEl = this.root.querySelector('.score')!;
    this.depthEl = this.root.querySelector('.depth')!;
    this.promptEl = this.root.querySelector('.prompt')!;

    this.pause = el('div', 'panel hidden');
    this.pause.innerHTML = `
      <div class="title" style="font-size:54px">PAUSED</div>
      <div class="keyhint">click to resume</div>`;
    parent.appendChild(this.pause);
  }

  show(): void { this.root.style.display = 'block'; }
  hide(): void { this.root.style.display = 'none'; this.promptEl.classList.remove('show'); }

  update(rs: RunState, prompt = '', levelName = ''): void {
    this.sanityFill.style.transform = `scaleX(${Math.max(0, rs.sanity / 100)})`;
    this.powerFill.style.transform = `scaleX(${Math.max(0, rs.power / 100)})`;
    this.scoreEl.textContent = String(Math.floor(rs.score));
    this.depthEl.textContent = levelName ? `SUBLEVEL ${rs.depth} · ${levelName}` : `SUBLEVEL ${rs.depth}`;
    this.sanityFx.style.opacity = String(Math.min(0.9, (1 - rs.sanity / 100) * 1.1));
    if (prompt) { this.promptEl.textContent = prompt; this.promptEl.classList.add('show'); }
    else this.promptEl.classList.remove('show');
  }

  flash(strength = 0.5): void {
    this.flashFx.style.opacity = String(strength);
    requestAnimationFrame(() => requestAnimationFrame(() => { this.flashFx.style.opacity = '0'; }));
  }

  /** Black-out, run `mid` at peak, fade back in. */
  async transition(mid: () => void): Promise<void> {
    this.cover.style.opacity = '1';
    await sleep(320);
    mid();
    await sleep(80);
    this.cover.style.opacity = '0';
    await sleep(300);
  }

  showPause(): void { this.pause.classList.remove('hidden'); }
  hidePause(): void { this.pause.classList.add('hidden'); }
  onPauseClick(fn: () => void): void { this.pause.addEventListener('click', fn); }
}

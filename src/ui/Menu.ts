import { el } from './dom';

/** Title screen and death screen. `onStart` begins a fresh run from both. */
export class Menu {
  private title: HTMLDivElement;
  private death: HTMLDivElement;
  onStart: () => void = () => {};

  constructor(parent: HTMLElement) {
    this.title = el('div', 'panel');
    this.title.innerHTML = `
      <div class="title">F6 FACILITY</div>
      <div class="subtitle">CONTAINMENT IS A SUGGESTION</div>
      <div class="blurb">
        You are a technician of the F6 program. In the <b>Lab</b> you take a subject that
        still looks almost human and refine it — injection by injection — into something
        that should not exist, then <b>release it into the facility</b>.<br/>
        Then you go down into the dark with the things you made. Your flashlight is dying.
        Your mind is next. Go <b>deeper</b> for a higher score. Nothing you create can be
        un-created. You will not survive the night — only outlast your last run.
      </div>
      <button class="btn" id="startBtn">ENTER THE FACILITY</button>
      <div class="keyhint">
        <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move &nbsp;·&nbsp; <kbd>MOUSE</kbd> look
        &nbsp;·&nbsp; <kbd>SHIFT</kbd> run &nbsp;·&nbsp; <kbd>F</kbd> flashlight &nbsp;·&nbsp; <kbd>E</kbd> interact
        <br/>in the Lab: <kbd>CLICK</kbd> to select an instrument · <kbd>DOUBLE-CLICK</kbd> to commit
      </div>`;
    parent.appendChild(this.title);

    this.death = el('div', 'panel hidden');
    parent.appendChild(this.death);

    this.title.querySelector('#startBtn')!.addEventListener('click', () => this.onStart());
  }

  showTitle(): void { this.title.classList.remove('hidden'); this.death.classList.add('hidden'); }
  hide(): void { this.title.classList.add('hidden'); this.death.classList.add('hidden'); }

  showDeath(score: number, best: number, cause: string, record: boolean): void {
    this.title.classList.add('hidden');
    this.death.classList.remove('hidden');
    this.death.innerHTML = `
      <div class="title" style="font-size:64px; color:var(--blood-bright)">YOU DIED</div>
      <div class="deathcause">${cause}</div>
      <div class="score-line">
        FINAL SCORE <span class="big">${Math.floor(score)}</span>
        ${record ? '<span class="best">★ NEW RECORD</span>' : `<span class="best">best ${best}</span>`}
      </div>
      <button class="btn" id="againBtn">RUN IT AGAIN</button>
      <div class="keyhint">the facility resets. the things you made do not remember mercy.</div>`;
    this.death.querySelector('#againBtn')!.addEventListener('click', () => this.onStart());
  }
}

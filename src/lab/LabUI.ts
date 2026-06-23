import { el } from '../ui/dom';
import { attachClickDual } from '../core/Input';
import { CREATURES, ALL_IDS, type CreatureId } from '../creatures/CreatureSpec';
import { creatureCanvas, creatureThumb } from '../creatures/CreatureArt';
import { ExperimentMachine, INSTRUMENTS, STAGES, type Instrument } from './ExperimentMachine';
import { applyStageVisual, shudder } from './SubjectView';
import type { RunState } from '../game/RunState';
import type { AudioManager } from '../audio/AudioManager';

export interface LabContext {
  runState: RunState;
  audio: AudioManager;
  punch: (n: number) => void;
  onEnter: () => void;
}

/** The point-and-click containment console. Select an instrument, then press
 *  COMMIT (or double-click the instrument) to run the experiment that mutates
 *  and finally releases the subject. */
export class LabUI {
  private root: HTMLDivElement | null = null;
  private canvas!: HTMLCanvasElement;
  private cctx!: CanvasRenderingContext2D;
  private blood!: HTMLDivElement;
  private stageTag!: HTMLDivElement;
  private subjName!: HTMLDivElement;
  private instabilityFill!: HTMLDivElement;
  private bankEl!: HTMLElement;
  private enterBtn!: HTMLButtonElement;
  private commitBtn!: HTMLButtonElement;
  private noteEl!: HTMLDivElement;
  private instrumentEls: HTMLButtonElement[] = [];
  private dotEls = new Map<CreatureId, HTMLDivElement>();

  private machine = new ExperimentMachine();
  private selectedId: CreatureId = 'weeper';
  private selectedInstrument: Instrument | null = null;

  constructor(private ctx: LabContext) {}

  mount(parent: HTMLElement): void {
    const root = el('div', 'lab');
    root.innerHTML = `
      <div class="labhead">
        <div class="sys">F6 // CONTAINMENT &amp; REFINEMENT &nbsp; <b>● LIVE SUBJECT</b></div>
        <div class="bank">BANKED SCORE&nbsp; <b id="bank">0</b></div>
      </div>
      <div class="viewport">
        <div class="stageTag"></div>
        <canvas class="specimen" width="384" height="512" style="height:auto"></canvas>
        <div class="blood" style="position:absolute;inset:0;pointer-events:none;opacity:0;
             background:radial-gradient(ellipse at 50% 35%, rgba(150,5,10,.5), transparent 60%),
             repeating-linear-gradient(95deg, rgba(120,0,0,.4) 0 2px, transparent 2px 7px);"></div>
        <div class="glass"></div>
        <div class="subjname"></div>
        <div class="instability"><div class="fill"></div></div>
      </div>
      <div class="console">
        <h3>INSTRUMENTS — click to select</h3>
        <div id="instruments"></div>
        <button class="btn commit" id="commitBtn" style="width:100%;margin-top:4px">▶ COMMIT EXPERIMENT</button>
        <div id="note" style="font-size:11px;color:#7a7a82;line-height:1.6;margin-top:8px"></div>
      </div>
      <div class="labfoot">
        <div class="subjects" id="subjects"></div>
        <button class="btn" id="enterBtn">DESCEND INTO FACILITY ▾</button>
      </div>`;
    parent.appendChild(root);
    this.root = root;
    this.instrumentEls = [];
    this.dotEls.clear();

    this.canvas = root.querySelector('.specimen')!;
    this.cctx = this.canvas.getContext('2d')!;
    this.blood = root.querySelector('.blood')!;
    this.stageTag = root.querySelector('.stageTag')!;
    this.subjName = root.querySelector('.subjname')!;
    this.instabilityFill = root.querySelector('.instability .fill')!;
    this.bankEl = root.querySelector('#bank')!;
    this.enterBtn = root.querySelector('#enterBtn')!;
    this.commitBtn = root.querySelector('#commitBtn')!;
    this.noteEl = root.querySelector('#note')!;

    const instWrap = root.querySelector('#instruments')!;
    for (const inst of INSTRUMENTS) {
      const b = el('button', 'instrument');
      b.innerHTML = `<div class="nm">${inst.name}</div><div class="ds">${inst.desc}</div>
        <div class="commit-hint">▶ SELECTED — press COMMIT or double-click</div>`;
      attachClickDual(b, () => this.selectInstrument(inst), () => this.commit(inst));
      instWrap.appendChild(b);
      this.instrumentEls.push(b);
    }

    const subWrap = root.querySelector('#subjects')!;
    for (const id of ALL_IDS) {
      const d = el('div', 'subjdot');
      d.style.backgroundImage = `url(${creatureThumb(id)})`;
      d.title = CREATURES[id].name;
      d.addEventListener('click', () => this.selectSubject(id));
      subWrap.appendChild(d);
      this.dotEls.set(id, d);
    }

    this.commitBtn.addEventListener('click', () => {
      if (this.selectedInstrument) this.commit(this.selectedInstrument);
    });
    this.enterBtn.addEventListener('click', () => {
      if (this.ctx.runState.released.length >= 1) this.ctx.onEnter();
    });

    const first = ALL_IDS.find((id) => !this.ctx.runState.hasReleased(id)) ?? 'weeper';
    this.selectSubject(first);
    this.refresh();
  }

  unmount(): void {
    this.root?.remove();
    this.root = null;
  }

  private selectSubject(id: CreatureId): void {
    this.selectedId = id;
    this.machine.reset();
    this.updateStageVisuals();
    const spec = CREATURES[id];
    this.subjName.innerHTML = `${spec.name}<small>${spec.designation} · STATUS: ${this.ctx.runState.hasReleased(id) ? 'RELEASED' : 'CONTAINED'}</small>`;
    // pre-select the first instrument so COMMIT works immediately
    this.selectInstrument(INSTRUMENTS[0]);
    this.refresh();
  }

  private selectInstrument(inst: Instrument): void {
    if (this.lockedForSubject()) return;
    this.selectedInstrument = inst;
    this.instrumentEls.forEach((b, i) =>
      b.classList.toggle('selected', INSTRUMENTS[i].id === inst.id));
    this.noteEl.textContent = `${inst.name}: ${inst.desc}`;
  }

  private commit(inst: Instrument): void {
    if (this.lockedForSubject()) return;
    this.selectInstrument(inst);
    const res = this.machine.apply(inst);
    this.updateStageVisuals();

    if (res.stageChanged) {
      shudder(this.canvas);
      this.ctx.audio.stinger('transform');
      this.ctx.punch(0.8);
      this.noteEl.textContent = CREATURES[this.selectedId].labText;
    }

    if (res.completed) {
      const payout = this.machine.payout();
      this.ctx.runState.addScore(payout);
      this.ctx.runState.releaseSpecimen(this.selectedId);
      this.ctx.audio.stinger('growl');
      this.ctx.punch(1.2);
      const spec = CREATURES[this.selectedId];
      this.subjName.innerHTML = `${spec.name}<small>${spec.designation} · RELEASED · +${payout}</small>`;
      this.stageTag.innerHTML = `MONSTER &nbsp;—&nbsp; <span style="color:var(--blood-bright)">SPECIMEN RELEASED</span>`;
      this.dotEls.get(this.selectedId)!.classList.add('released');
    }
    this.refresh();
  }

  private lockedForSubject(): boolean {
    return this.ctx.runState.hasReleased(this.selectedId) || this.machine.completed;
  }

  private updateStageVisuals(): void {
    // redraw the subject art at the current mutation level
    const art = creatureCanvas(this.selectedId, this.machine.stageFraction, 1);
    this.cctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.cctx.drawImage(art, 0, 0);
    const idx = STAGES.indexOf(this.machine.stage);
    applyStageVisual(this.canvas, this.blood, idx);
    this.instabilityFill.style.height = `${this.machine.instability}%`;
    if (!this.machine.completed) this.stageTag.textContent = this.machine.stage;
  }

  private refresh(): void {
    this.bankEl.textContent = String(Math.floor(this.ctx.runState.score));
    this.dotEls.forEach((d, id) => {
      d.classList.toggle('active', id === this.selectedId);
      d.classList.toggle('released', this.ctx.runState.hasReleased(id));
    });
    const locked = this.lockedForSubject();
    this.commitBtn.disabled = locked;
    this.commitBtn.style.opacity = locked ? '0.4' : '1';
    this.commitBtn.style.cursor = locked ? 'not-allowed' : 'pointer';

    const ready = this.ctx.runState.released.length >= 1;
    this.enterBtn.disabled = !ready;
    this.enterBtn.style.opacity = ready ? '1' : '0.45';
    this.enterBtn.style.cursor = ready ? 'pointer' : 'not-allowed';

    if (locked && !this.machine.completed) {
      this.noteEl.textContent = 'This specimen has already been released into the facility.';
    } else if (!ready) {
      this.noteEl.textContent = 'Pick an instrument and press COMMIT. Drive one subject to MONSTER, then descend.';
    }
  }
}

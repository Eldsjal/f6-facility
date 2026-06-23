export type Stage = 'PRISTINE' | 'UNCANNY' | 'DISTRESSED' | 'MUTATING' | 'MONSTER';
export const STAGES: Stage[] = ['PRISTINE', 'UNCANNY', 'DISTRESSED', 'MUTATING', 'MONSTER'];

// instability thresholds where each stage begins
const THRESHOLDS = [0, 22, 46, 72, 100];

export interface Instrument {
  id: string;
  name: string;
  desc: string;
  min: number;
  max: number; // instability added is random in [min,max]
}

export const INSTRUMENTS: Instrument[] = [
  { id: 'serum', name: 'INJECT MUTAGEN', desc: 'Catalytic serum. Steady, predictable escalation.', min: 24, max: 32 },
  { id: 'voltage', name: 'RAISE VOLTAGE', desc: 'Cortical overload. A violent jump — but volatile.', min: 40, max: 56 },
  { id: 'signal', name: 'EXPOSE TO SIGNAL', desc: 'The F6 frequency. Wildly unpredictable.', min: 14, max: 52 },
  { id: 'deprive', name: 'SENSORY DEPRIVE', desc: 'Total blackout. Slow, gentle, efficient.', min: 18, max: 26 },
];

export interface ApplyResult {
  stageChanged: boolean;
  completed: boolean;
  stage: Stage;
}

/** Drives one subject from PRISTINE to MONSTER as instruments are committed. */
export class ExperimentMachine {
  instability = 0;
  commits = 0;
  private stageIndex = 0;

  reset(): void {
    this.instability = 0;
    this.commits = 0;
    this.stageIndex = 0;
  }

  get stage(): Stage { return STAGES[this.stageIndex]; }
  get stageFraction(): number { return this.stageIndex / (STAGES.length - 1); }
  get completed(): boolean { return this.stageIndex >= STAGES.length - 1; }

  apply(inst: Instrument): ApplyResult {
    if (this.completed) return { stageChanged: false, completed: true, stage: this.stage };
    const add = inst.min + Math.random() * (inst.max - inst.min);
    this.instability = Math.min(100, this.instability + add);
    this.commits++;

    let newIndex = 0;
    for (let i = 0; i < THRESHOLDS.length; i++) {
      if (this.instability >= THRESHOLDS[i]) newIndex = i;
    }
    const stageChanged = newIndex !== this.stageIndex;
    this.stageIndex = newIndex;
    return { stageChanged, completed: this.completed, stage: this.stage };
  }

  /** Score for finishing a transformation — fewer commits = bigger payoff. */
  payout(): number {
    return Math.round(500 + Math.max(0, 8 - this.commits) * 55);
  }
}

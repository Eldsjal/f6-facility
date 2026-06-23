import { randomSeed } from '../core/Random';
import type { CreatureId } from '../creatures/CreatureSpec';

const BEST_KEY = 'f6_best_score';

/** Single source of truth for a run. Permadeath: reset() starts a fresh run. */
export class RunState {
  sanity = 100;
  power = 100;
  score = 0;
  depth = 1;
  timeAlive = 0;
  released: CreatureId[] = [];
  experimentsCompleted = 0;
  seed = randomSeed();
  bestScore = Number(localStorage.getItem(BEST_KEY) ?? 0);

  reset(): void {
    this.sanity = 100;
    this.power = 100;
    this.score = 0;
    this.depth = 1;
    this.timeAlive = 0;
    this.released = [];
    this.experimentsCompleted = 0;
    this.seed = randomSeed();
  }

  addScore(n: number): void { this.score += n; }

  releaseSpecimen(id: CreatureId): void {
    if (!this.released.includes(id)) this.released.push(id);
    this.experimentsCompleted++;
  }
  hasReleased(id: CreatureId): boolean { return this.released.includes(id); }

  drainPower(a: number): void { this.power = Math.max(0, this.power - a); }
  addPower(a: number): void { this.power = Math.min(100, this.power + a); }
  drainSanity(a: number): void { this.sanity = Math.max(0, this.sanity - a); }
  addSanity(a: number): void { this.sanity = Math.min(100, this.sanity + a); }

  /** Persist best score; returns true if a new record was set. */
  saveBest(): boolean {
    const s = Math.floor(this.score);
    if (s > this.bestScore) {
      this.bestScore = s;
      localStorage.setItem(BEST_KEY, String(s));
      return true;
    }
    return false;
  }
}

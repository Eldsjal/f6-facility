import { createAmbient, type Ambient } from './synth/ambient';
import { footstep } from './synth/footsteps';
import { thump } from './synth/heartbeat';
import { stinger, type Sting } from './synth/stingers';

/**
 * Single AudioContext for the whole game. Ambient bed is continuous; the
 * heartbeat is scheduled from the game loop at a rate driven by how close the
 * nearest creature is; footsteps and stingers are fire-and-forget.
 */
export class AudioManager {
  private ctx: AudioContext;
  private master: GainNode;
  private ambient: Ambient;

  private bpm = 55;
  private hbLevel = 0;
  private hbActive = false;
  private nextBeat = 0;

  constructor() {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(this.ctx.destination);
    this.ambient = createAmbient(this.ctx, this.master);
  }

  /** Must be called from a user gesture (browser autoplay policy). */
  resume(): void {
    if (this.ctx.state !== 'running') void this.ctx.resume();
  }

  startAmbient(): void { this.ambient.start(); }
  stopAmbient(): void { this.ambient.stop(); }
  setAmbientIntensity(v: number): void { this.ambient.setIntensity(v); }

  footstep(intensity: number): void {
    if (this.ctx.state === 'running') footstep(this.ctx, this.master, intensity);
  }

  stinger(type: Sting): void {
    if (this.ctx.state === 'running') stinger(this.ctx, this.master, type);
  }

  /** Update heartbeat parameters from the nearest creature distance. */
  setThreat(nearest: number, chasing: boolean): void {
    const RANGE = 16;
    if (nearest < RANGE) {
      const prox = 1 - nearest / RANGE;
      this.hbActive = true;
      this.bpm = 52 + prox * 96;
      this.hbLevel = (0.12 + prox * 0.5) * (chasing ? 1.25 : 1);
    } else {
      this.hbActive = false;
      this.hbLevel = 0;
    }
  }

  /** Drive heartbeat scheduling from the game loop. */
  update(_dt: number): void {
    if (!this.hbActive || this.ctx.state !== 'running') {
      this.nextBeat = 0;
      return;
    }
    if (this.nextBeat === 0) this.nextBeat = this.ctx.currentTime;
    let guard = 0;
    while (this.ctx.currentTime >= this.nextBeat && guard++ < 8) {
      thump(this.ctx, this.master, this.hbLevel);
      this.nextBeat += 60 / this.bpm;
    }
  }
}

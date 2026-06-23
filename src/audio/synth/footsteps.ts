import { noiseBuffer } from './dsp';

/** A short bandpassed noise thud. Volume scales with movement speed. */
export function footstep(ctx: AudioContext, dest: AudioNode, intensity: number): void {
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, 0.14);

  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 170 + Math.random() * 110;
  bp.Q.value = 0.7;

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.04 + 0.13 * intensity, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);

  src.connect(bp);
  bp.connect(g);
  g.connect(dest);
  src.start(t);
  src.stop(t + 0.15);
}

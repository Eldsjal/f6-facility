import { noiseBuffer, makeDistortion } from './dsp';

export type Sting = 'growl' | 'jump' | 'transform' | 'death';

/** One-shot scare hits. All synthesized — no samples, no licensing. */
export function stinger(ctx: AudioContext, dest: AudioNode, type: Sting): void {
  const t = ctx.currentTime;
  const out = ctx.createGain();
  out.connect(dest);

  if (type === 'growl') {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.6);
    const dist = makeDistortion(ctx, 0.4);
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.4, t + 0.05);
    out.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    o.connect(dist); dist.connect(out);
    o.start(t); o.stop(t + 0.85);
  } else if (type === 'jump') {
    // loud broadband hit + downward shriek
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 0.5);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 600;
    const o = ctx.createOscillator(); o.type = 'square';
    o.frequency.setValueAtTime(1800, t);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.45);
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.85, t + 0.01);
    out.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    src.connect(hp); hp.connect(out); o.connect(out);
    src.start(t); src.stop(t + 0.5); o.start(t); o.stop(t + 0.5);
  } else if (type === 'transform') {
    // metallic glitch swell
    const o = ctx.createOscillator(); o.type = 'square';
    o.frequency.setValueAtTime(140, t);
    o.frequency.linearRampToValueAtTime(520, t + 0.4);
    const dist = makeDistortion(ctx, 0.8);
    const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 28;
    const lfoG = ctx.createGain(); lfoG.gain.value = 200; lfo.connect(lfoG); lfoG.connect(o.frequency);
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.5, t + 0.04);
    out.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.connect(dist); dist.connect(out);
    o.start(t); o.stop(t + 0.6); lfo.start(t); lfo.stop(t + 0.6);
  } else { // death
    for (const f of [220, 174, 130]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 0.4, t + 1.6);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.1);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + 1.9);
    }
  }
}

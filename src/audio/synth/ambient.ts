// The continuous dread bed: detuned sub-bass drone + a slow breathing filter +
// a faint fluorescent whine. Pure synthesis, loops forever, never restarts.

export interface Ambient {
  start(): void;
  stop(): void;
  setIntensity(v: number): void;
}

export function createAmbient(ctx: AudioContext, dest: AudioNode): Ambient {
  const out = ctx.createGain();
  out.gain.value = 0.0001;
  out.connect(dest);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 300;
  filter.connect(out);

  const oscs: OscillatorNode[] = [];
  for (const f of [41.2, 55.0, 82.4]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    o.detune.value = (Math.random() - 0.5) * 14;
    const g = ctx.createGain();
    g.gain.value = 0.22;
    o.connect(g);
    g.connect(filter);
    oscs.push(o);
  }

  // slow "breathing" of the filter cutoff
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 130;
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);

  // high fluorescent whine
  const whine = ctx.createOscillator();
  whine.type = 'triangle';
  whine.frequency.value = 8400;
  const whineG = ctx.createGain();
  whineG.gain.value = 0.005;
  whine.connect(whineG);
  whineG.connect(out);

  let started = false;
  return {
    start() {
      if (started) return;
      started = true;
      const t = ctx.currentTime;
      oscs.forEach((o) => o.start());
      lfo.start();
      whine.start();
      out.gain.setTargetAtTime(0.5, t, 1.4);
    },
    stop() {
      out.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.5);
    },
    setIntensity(v: number) {
      out.gain.setTargetAtTime(0.32 + v * 0.5, ctx.currentTime, 0.6);
    },
  };
}

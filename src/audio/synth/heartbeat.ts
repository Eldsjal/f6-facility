// One lub-dub heartbeat, scheduled by AudioManager at a proximity-driven rate.

export function thump(ctx: AudioContext, dest: AudioNode, level: number): void {
  const beat = (at: number, freq: number, gain: number) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, at);
    o.frequency.exponentialRampToValueAtTime(freq * 0.5, at + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
    o.connect(g);
    g.connect(dest);
    o.start(at);
    o.stop(at + 0.2);
  };
  const t = ctx.currentTime;
  beat(t, 58, level);          // lub
  beat(t + 0.16, 46, level * 0.78); // dub
}

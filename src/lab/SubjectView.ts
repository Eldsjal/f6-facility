import { STAGES } from './ExperimentMachine';

/**
 * The subject art is already redrawn per stage (calm → monstrous); this layers
 * a little extra CSS grit on top: a touch of blur/haze early so it reads as an
 * indistinct, almost-pleasant subject, sharpening and bleeding as it mutates.
 */
export function applyStageVisual(el: HTMLElement, bloodEl: HTMLElement, stageIndex: number): void {
  const f = stageIndex / (STAGES.length - 1); // 0..1
  const blur = (1 - f) * 2.2;
  const gray = (1 - f) * 0.4;
  const bright = 1.1 - f * 0.35;
  const contrast = 0.9 + f * 0.5;
  const sat = 0.7 + f * 0.7;
  el.style.filter =
    `grayscale(${gray}) brightness(${bright}) contrast(${contrast}) saturate(${sat}) blur(${blur}px)`;
  el.style.transform = `scale(${1 + f * 0.05})`;
  bloodEl.style.opacity = String(Math.max(0, f - 0.45) * 1.6);
}

/** Brief visual shudder applied on each stage threshold crossing. */
export function shudder(target: HTMLElement): void {
  target.classList.remove('glitch');
  // force reflow so the animation can retrigger
  void target.offsetWidth;
  target.classList.add('glitch');
}

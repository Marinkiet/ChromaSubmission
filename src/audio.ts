/** Tiny synthesised sounds, so there are no audio assets to load. */

let ctx: AudioContext | null = null;

function blip(freq: number, duration: number, gain: number, when = 0): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  } catch {
    // Audio is optional; never let it break gameplay.
  }
}

export const playHover = () => blip(880, 0.05, 0.03);
export const playGood = () => {
  blip(523, 0.18, 0.08);
  blip(784, 0.22, 0.08, 0.08);
};
export const playBonus = () => {
  blip(523, 0.15, 0.08);
  blip(659, 0.15, 0.08, 0.07);
  blip(988, 0.3, 0.08, 0.14);
};
export const playBad = () => blip(160, 0.3, 0.1);
export const playClue = () => blip(660, 0.35, 0.05);
/** A rule changed: a low, rising swell. */
export const playSwitch = () => {
  blip(196, 0.5, 0.08);
  blip(294, 0.5, 0.06, 0.15);
};

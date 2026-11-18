import { describe, expect, it } from 'vitest';
import { nextClue } from './clue.js';
import { TUTORIAL_CONFIG } from './configs.js';
import { DiscoveryTracker } from './discovery.js';
import { HoldTimer, TwoHandGesture, isOpenPalm } from './gestures.js';
import type { Joints } from './gestures.js';

/** Synthetic hand. Fingers point along +y; `curl` pulls the tips back to the knuckle. */
function hand(opts: { curl?: boolean; pinch?: boolean } = {}): Joints {
  const j: Joints = { wrist: [0, 0, 0] };
  const xs = { 'index-finger': -0.03, 'middle-finger': -0.01, 'ring-finger': 0.01, 'pinky-finger': 0.03 };
  for (const [f, x] of Object.entries(xs)) {
    j[`${f}-phalanx-proximal`] = [x, 0.09, 0];
    j[`${f}-tip`] = [x, opts.curl ? 0.1 : 0.19, 0];
  }
  j['thumb-tip'] = opts.pinch ? [-0.03, 0.19, 0.005] : [-0.08, 0.08, 0];
  return j;
}

describe('isOpenPalm', () => {
  it('recognises an open hand', () => expect(isOpenPalm(hand())).toBe(true));
  it('rejects a fist', () => expect(isOpenPalm(hand({ curl: true }))).toBe(false));
  it('rejects a pinch even with fingers out', () => {
    expect(isOpenPalm(hand({ pinch: true }))).toBe(false);
  });
  it('rejects missing joints (tracking loss)', () => {
    expect(isOpenPalm({})).toBe(false);
    const h = hand();
    delete h['pinky-finger-tip'];
    expect(isOpenPalm(h)).toBe(false);
  });
  it('rejects an all-zero untracked hand', () => {
    const zero: Joints = {};
    for (const k of Object.keys(hand())) zero[k] = [0, 0, 0];
    expect(isOpenPalm(zero)).toBe(false);
  });
});

describe('HoldTimer', () => {
  it('fires after the hold time, once', () => {
    const t = new HoldTimer(0.5, 2);
    let fired = 0;
    for (let i = 0; i < 100; i++) if (t.update(0.016, true)) fired++;
    expect(fired).toBe(1);
  });
  it('does not fire on a brief gesture', () => {
    const t = new HoldTimer(0.5, 2);
    expect(t.update(0.3, true)).toBe(false);
    expect(t.update(0.3, false)).toBe(false);
    expect(t.update(0.3, true)).toBe(false); // progress was reset by the release
  });
  it('blocks repeats until released and cooled down', () => {
    const t = new HoldTimer(0.2, 1);
    expect(t.update(0.25, true)).toBe(true);
    // released, but still cooling down
    t.update(0.1, false);
    expect(t.update(0.3, true)).toBe(false);
    // cooldown over after another second of releasing
    t.update(1.0, false);
    expect(t.update(0.25, true)).toBe(true);
  });
  it('holding forever never re-fires without a release', () => {
    const t = new HoldTimer(0.2, 0.1);
    let fired = 0;
    for (let i = 0; i < 600; i++) if (t.update(0.016, true)) fired++;
    expect(fired).toBe(1);
  });
  it('reports progress', () => {
    const t = new HoldTimer(1, 1);
    t.update(0.5, true);
    expect(t.progress).toBeCloseTo(0.5);
  });
});

describe('TwoHandGesture', () => {
  it('needs both hands open and held', () => {
    const g = new TwoHandGesture(0.5, 1);
    expect(g.update(0.6, true, false)).toBe(false);
    expect(g.update(0.6, true, null)).toBe(false);
    expect(g.update(0.3, true, true)).toBe(false);
    expect(g.update(0.3, true, true)).toBe(true);
  });
  it('tracking loss mid-hold resets progress, recovery restarts it', () => {
    const g = new TwoHandGesture(0.5, 1);
    g.update(0.4, true, true);
    g.update(0.016, true, null); // lost
    expect(g.progress).toBe(0);
    expect(g.update(0.4, true, true)).toBe(false);
    expect(g.update(0.2, true, true)).toBe(true);
  });
});

describe('clues', () => {
  it('hints at the first undiscovered rule without stating it', () => {
    const d = new DiscoveryTracker();
    expect(nextClue(TUTORIAL_CONFIG, d)).toMatch(/follows Red/);
    d.record('red-blue');
    expect(nextClue(TUTORIAL_CONFIG, d)).toMatch(/follows Blue/);
  });
  it('says so when everything is found', () => {
    const d = new DiscoveryTracker();
    TUTORIAL_CONFIG.rules.forEach((r) => d.record(r.id));
    expect(nextClue(TUTORIAL_CONFIG, d)).toMatch(/every rule/);
  });
});

import { createSystem } from '@iwsdk/core';
import { playClue } from './audio.js';
import { nextClue } from './game/clue.js';
import { HoldTimer, TwoHandGesture, isOpenPalm } from './game/gestures.js';
import type { Joints } from './game/gestures.js';
import { inputAllowed, session, ui } from './game/instance.js';
import { Phase } from './game/session.js';

type Side = 'left' | 'right';
const NEEDED = [
  'wrist',
  'thumb-tip',
  'index-finger-tip',
  'index-finger-phalanx-proximal',
  'middle-finger-tip',
  'middle-finger-phalanx-proximal',
  'ring-finger-tip',
  'ring-finger-phalanx-proximal',
  'pinky-finger-tip',
  'pinky-finger-phalanx-proximal',
];

/**
 * Reads real hand joints from IWSDK's hand adapter and runs the pure gesture
 * recognisers.
 *   one open palm held   -> clue
 *   both open palms held -> two-hand ability (placeholder)
 * In the labelled dev fallback, keys C (clue) and B (ability) stand in.
 */
export class HandGestureSystem extends createSystem({}) {
  private clueTimer = new HoldTimer(0.7, 6);
  private twoHand = new TwoHandGesture(0.8, 3);
  private now = 0;
  private joints: Record<Side, Record<string, [number, number, number]>> = {
    left: {},
    right: {},
  };

  init(): void {
    for (const side of ['left', 'right'] as Side[]) {
      for (const n of NEEDED) this.joints[side][n] = [0, 0, 0];
    }
    const onKey = (e: KeyboardEvent) => {
      if (ui.inputMode !== 'dev-mouse') return;
      if (e.code === 'KeyC') this.giveClue();
      if (e.code === 'KeyB') this.ability();
    };
    window.addEventListener('keydown', onKey);
    this.cleanupFuncs.push(() => window.removeEventListener('keydown', onKey));
  }

  /** Fills the preallocated joint table; returns null when the hand is not tracked. */
  private read(side: Side): Joints | null {
    if (!this.input.xr.isPrimary('hand', side)) return null;
    const adapter = this.input.xr.visualAdapters.hand[side];
    const t = adapter.jointTransforms;
    if (!t || adapter.jointSpaces.length === 0) return null;
    const out = this.joints[side];
    let found = 0;
    adapter.jointSpaces.forEach((space, i) => {
      const slot = out[space.jointName];
      if (!slot) return;
      slot[0] = t[i * 16 + 12];
      slot[1] = t[i * 16 + 13];
      slot[2] = t[i * 16 + 14];
      found++;
    });
    return found === NEEDED.length ? out : null;
  }

  private giveClue(): void {
    ui.clue = nextClue(session.config, session.discovery);
    playClue();
  }

  private ability(): void {
    ui.message = 'Two-hand gesture recognised (abilities come later).';
    ui.tone = 'info';
    ui.abilityFlashUntil = this.now + 1.2;
    playClue();
  }

  update(delta: number): void {
    this.now += delta;
    const active = ui.inputMode === 'hands' && session.phase === Phase.Selecting && inputAllowed();

    if (!active) {
      this.clueTimer.reset();
      this.twoHand.reset();
      ui.palmProgress = 0;
      ui.abilityProgress = 0;
      return;
    }

    const l = this.read('left');
    const r = this.read('right');
    const lOpen = l ? isOpenPalm(l) : null;
    const rOpen = r ? isOpenPalm(r) : null;

    if (this.twoHand.update(delta, lOpen, rOpen)) this.ability();
    // Exactly one open palm means "clue". Two open palms belong to the ability.
    const oneOpen = (lOpen === true) !== (rOpen === true);
    if (this.clueTimer.update(delta, oneOpen)) this.giveClue();

    ui.palmProgress = this.clueTimer.progress;
    ui.abilityProgress = this.twoHand.progress;
  }
}

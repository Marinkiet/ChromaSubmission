import { GameSession } from './session.js';
import { ChunkManager } from './world/chunk-manager.js';
import {
  DECEPTION_DEFAULTS,
  DECEPTION_OFF,
  without,
  withDifficulty,
} from './deception/settings.js';
import type { MechanicId } from './deception/settings.js';

/** Seed from ?seed=123 for reproducible runs; otherwise one per page load. */
function pickSeed(): number {
  if (typeof location !== 'undefined') {
    const m = /[?&]seed=(\d+)/.exec(location.search);
    if (m) return Number(m[1]) >>> 0;
  }
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

/**
 * Deception settings. Defaults on. For testing a mechanic on its own:
 *   ?deception=off          all mechanics off
 *   ?no=shift,memory        turn the listed ones off (shift, pattern, mirror, memory, ruleSwitch)
 *   ?deceive=0|1|2          difficulty for every mechanic
 */
function pickDeception() {
  const q = typeof location !== 'undefined' ? location.search : '';
  if (/[?&]deception=off/.test(q)) return DECEPTION_OFF;
  let s = DECEPTION_DEFAULTS;
  const no = /[?&]no=([a-zA-Z,]+)/.exec(q);
  if (no) s = without(no[1].split(',') as MechanicId[], s);
  const d = /[?&]deceive=([012])/.exec(q);
  if (d) s = withDifficulty(Number(d[1]) as 0 | 1 | 2, s);
  return s;
}

/** The endless world. Chunks come and go around the player's row. */
export const chunks = new ChunkManager({ seed: pickSeed(), deception: pickDeception() });

/** Set by the HUD on restart; TrackSystem rebuilds the tile pool next frame. */
export const worldFlags = { resetRequested: false };

/** The one running game. Systems read and write it; it knows nothing about them. */
export const session = new GameSession(chunks.rowConfig(0));
session.start();

export type InputMode = 'hands' | 'dev-mouse' | 'controllers-blocked' | 'none';
export type Tone = 'info' | 'good' | 'bad' | 'bonus';

/** Shared UI state written by input systems, read by the HUD. */
export const ui = {
  inputMode: 'none' as InputMode,
  message: 'Point at a tile and pinch to choose it.',
  tone: 'info' as Tone,
  clue: '',
  palmProgress: 0,
  abilityProgress: 0,
  abilityFlashUntil: 0,
  /** World time until which the "a rule changed" flash plays. */
  switchFlashUntil: 0,
};

/** Mechanics the player has been told about (drives intro hints and the shift display). */
export const introduced = new Set<string>();

/** Only real hand input (or the labelled dev fallback) may play the game. */
export function inputAllowed(): boolean {
  return ui.inputMode === 'hands' || ui.inputMode === 'dev-mouse';
}

/** Dev-only fallback switch: dev server, or add ?devinput to the URL. */
export const DEV_FALLBACK =
  import.meta.env.DEV || (typeof location !== 'undefined' && location.search.includes('devinput'));

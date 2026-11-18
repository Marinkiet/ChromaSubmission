import { COLOR_COUNT, COLS } from '../palette.js';

/**
 * MECHANIC 1: COLOUR SHIFT.
 * A shifting tile keeps its true colour (its rule identity never changes). Only
 * what is shown changes, and never on the row the player is choosing from.
 *
 *  - Choosing row  -> always the true colour (nothing critical is hidden).
 *  - Rows ahead, before the mechanic is understood -> drifts through colours.
 *  - Rows ahead, once understood -> mostly the true colour, with a brief drift.
 */
export function shiftDisplayColor(opts: {
  trueColor: number;
  tileId: number;
  time: number;
  isChoosingRow: boolean;
  understood: boolean;
}): number {
  const { trueColor, tileId, time, isChoosingRow, understood } = opts;
  if (isChoosingRow) return trueColor;
  const step = Math.floor(time / 0.8) + tileId * 3; // each tile drifts out of phase
  const drift = (trueColor + 1 + (((step % (COLOR_COUNT - 1)) + COLOR_COUNT - 1) % (COLOR_COUNT - 1))) % COLOR_COUNT;
  if (!understood) return Math.floor(time / 0.8 + tileId) % 2 === 0 ? drift : (drift + 2) % COLOR_COUNT;
  // Understood: the true colour shows two thirds of the time.
  return step % 3 === 0 ? drift : trueColor;
}

/**
 * MECHANIC 3: MIRROR. The tile body stays its true colour. A small reflection
 * bar shows the colour of the tile on the opposite side of the row.
 */
export function mirrorSourceCol(col: number): number {
  const m = COLS - 1 - col;
  return m === col ? (col + 1) % COLS : m;
}

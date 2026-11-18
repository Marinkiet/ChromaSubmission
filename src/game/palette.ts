/**
 * Pure game data. No three.js and no IWSDK imports, so rules can be tested in
 * isolation later and rendering stays separate from gameplay.
 */

export const TileColor = {
  Red: 0,
  Blue: 1,
  Yellow: 2,
  Green: 3,
  Purple: 4,
} as const;

export const COLOR_COUNT = 5;

/** Hex colours, indexed by TileColor. */
export const PALETTE = [0xff2a4a, 0x2a6bff, 0xffd21f, 0x1fe07a, 0xa43cff];

export const TileState = {
  Idle: 0,
  Highlighted: 1,
  Selected: 2,
} as const;

export const STATE_COUNT = 3;

/** Grid layout, in metres. */
export const COLS = 7;
export const ROWS = 12;
export const TILE_SIZE = 0.22;
export const TILE_PITCH = 0.25; // tile + gap
export const TILE_THICKNESS = 0.04;
export const TABLE_Y = 0.75; // tile surface height: a "table" in front of a seated player
export const NEAR_Z = -0.45; // distance of the nearest row from the player

/** Deterministic colour for a grid cell, so recycled rows are stable. */
export function colorAt(col: number, row: number): number {
  let h = (Math.imul(col + 1013, 374761393) + Math.imul(row + 7919, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) % COLOR_COUNT;
}

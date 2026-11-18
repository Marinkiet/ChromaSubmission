import { COLS, NEAR_Z, TILE_PITCH } from '../palette.js';

export const TileKind = { Normal: 0, Reward: 1, Mystery: 2 } as const;

/** Deception modifiers (bit flags). A tile carries at most one. */
export const Mod = { None: 0, Shift: 1, Mirror: 2, Memory: 4 } as const;

export interface TileSpec {
  /** Deception modifier flags (Mod). */
  mods: number;
  /** True colour. For a mystery tile this stays hidden until it is chosen. */
  color: number;
  kind: number;
  /** Part of the "always solvable" cover: never mystery, always visible. */
  protected: boolean;
}

export interface RowSpec {
  row: number;
  configId: string;
  tiles: TileSpec[]; // length COLS, index = column
  /** Colour state of the generator's reference path before this row (null = fresh). */
  star: number | null;
  /** How many distinct colour states a player might be in at this row. */
  reachableStates: number;
  /** Pattern illusion: 'lure' rows follow a predictable path, 'break' row does not. */
  pattern?: 'lure' | 'break';
}

/** A fixed-size section of the world. Plain data: it owns no GPU resources. */
export class Chunk {
  rows: RowSpec[];
  active = false;
  /** World z of the chunk's first row when the player has not scrolled yet. */
  readonly zStart: number;
  readonly zEnd: number;
  readonly tileCount: number;

  constructor(
    readonly id: number,
    readonly firstRow: number,
    rows: RowSpec[],
  ) {
    this.rows = rows;
    this.tileCount = rows.length * COLS;
    this.zStart = NEAR_Z - firstRow * TILE_PITCH;
    this.zEnd = NEAR_Z - (firstRow + rows.length - 1) * TILE_PITCH;
  }

  get lastRow(): number {
    return this.firstRow + this.rows.length - 1;
  }

  contains(row: number): boolean {
    return row >= this.firstRow && row <= this.lastRow;
  }

  /** Releases references so the data can be collected. */
  dispose(): void {
    this.active = false;
    this.rows = [];
  }
}

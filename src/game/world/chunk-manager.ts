import type { RuleConfig } from '../rules.js';
import { WorldGenerator } from './generator.js';
import type { WorldOptions } from './generator.js';
import { Chunk } from './types.js';
import type { RowSpec } from './types.js';

export interface ChunkUpdate {
  created: Chunk[];
  removed: Chunk[];
}
const NONE: ChunkUpdate = { created: [], removed: [] };

/**
 * Keeps a sliding window of chunks around the player:
 *   [current - behind ... current + ahead]
 * New chunks are made only when the player enters a new chunk, never per frame.
 * Chunks outside the window are disposed and dropped.
 */
export class ChunkManager {
  readonly chunks = new Map<number, Chunk>();
  readonly aheadChunks: number;
  readonly behindChunks: number;
  private gen: WorldGenerator;
  private opts: WorldOptions;
  private lastCurrent = -Infinity;
  private complete = false;

  stats = { created: 0, removed: 0, skipped: 0, updates: 0, work: 0 };

  constructor(opts: WorldOptions) {
    this.opts = opts;
    this.aheadChunks = opts.aheadChunks ?? 2;
    this.behindChunks = opts.behindChunks ?? 1;
    this.gen = new WorldGenerator(opts);
  }

  get seed(): number {
    return this.gen.seed;
  }
  get chunkRows(): number {
    return this.gen.chunkRows;
  }
  get currentChunkId(): number {
    return this.lastCurrent;
  }
  get liveChunks(): number {
    return this.chunks.size;
  }

  rowConfig(row: number): RuleConfig {
    return this.gen.rowConfig(row);
  }

  /** True when entering this row starts a new base rule set (the sequence is cleared). */
  clearsSequenceAt(row: number): boolean {
    return this.gen.resolver.clearsSequenceAt(row);
  }

  /** The planned rule switch that takes effect exactly at this row, if any. */
  ruleSwitchAt(row: number) {
    return this.gen.resolver.switchAt(row);
  }

  /** Call every frame with the player's row. Cheap unless the chunk changes. */
  update(playerRow: number): ChunkUpdate {
    this.stats.updates++;
    const cur = Math.floor(Math.max(0, playerRow) / this.chunkRows);
    if (cur === this.lastCurrent && this.complete) return NONE;
    this.stats.work++;

    const created: Chunk[] = [];
    const removed: Chunk[] = [];
    const lo = cur - this.behindChunks;
    const hi = cur + this.aheadChunks;

    // Generate strictly in order; anything already behind the window is skipped.
    while (this.gen.nextChunkId <= hi) {
      const c = this.gen.generateChunk();
      if (c.id >= lo) {
        this.chunks.set(c.id, c);
        created.push(c);
        this.stats.created++;
      } else {
        c.dispose();
        this.stats.skipped++;
      }
    }
    for (const [id, c] of this.chunks) {
      if (id < lo) {
        c.dispose();
        this.chunks.delete(id);
        removed.push(c);
        this.stats.removed++;
      } else {
        c.active = id >= cur; // chunks behind are kept but inactive
      }
    }
    this.lastCurrent = cur;
    this.complete = true;
    return { created, removed };
  }

  tryGetRow(row: number): RowSpec | undefined {
    const c = this.chunks.get(Math.floor(row / this.chunkRows));
    return c?.rows[row - c.firstRow];
  }

  getRow(row: number): RowSpec {
    const spec = this.tryGetRow(row);
    if (!spec) throw new Error(`Row ${row} is outside the live window (chunk ${this.lastCurrent})`);
    return spec;
  }

  /** Start a fresh world, optionally with a new seed. */
  reset(seed?: number): void {
    for (const c of this.chunks.values()) c.dispose();
    this.chunks.clear();
    this.opts = { ...this.opts, seed: seed ?? this.opts.seed };
    this.gen = new WorldGenerator(this.opts);
    this.lastCurrent = -Infinity;
    this.complete = false;
    this.stats = { created: 0, removed: 0, skipped: 0, updates: 0, work: 0 };
  }
}

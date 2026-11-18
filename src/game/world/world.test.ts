import { describe, expect, it } from 'vitest';
import { RULESETS } from '../configs.js';
import { COLS } from '../palette.js';
import { checkConfig, deadEnds, validateSelection } from '../rules.js';
import { ChunkManager } from './chunk-manager.js';
import { DEFAULT_TIERS, configForDistance, tierForDistance } from './difficulty.js';
import { WorldGenerator } from './generator.js';
import { readHeapBytes } from './memory.js';
import { TileKind } from './types.js';

const strip = (g: WorldGenerator, n: number) =>
  JSON.stringify(Array.from({ length: n }, () => g.generateChunk().rows));

describe('rule sets', () => {
  for (const [name, cfg] of Object.entries(RULESETS)) {
    it(`${name} has no dead ends and is well-formed`, () => {
      expect(deadEnds(cfg)).toEqual([]);
      expect(checkConfig(cfg)).toEqual([]);
    });
  }
  it('checkConfig now flags dead ends', () => {
    const broken = { ...RULESETS.tutorial, fallback: 'invalid' as const, rules: [] };
    expect(checkConfig(broken).some((p) => /dead-end/.test(p))).toBe(true);
  });
});

describe('difficulty tiers', () => {
  it('switch at the documented distances', () => {
    const at = (d: number) => tierForDistance(d).from;
    expect([0, 20, 21, 50, 51, 100, 101, 200, 201, 5000].map(at)).toEqual([
      0, 0, 21, 21, 51, 51, 101, 101, 201, 201,
    ]);
  });
  it('picks the matching rule set', () => {
    expect(configForDistance(10).id).toBe('tutorial');
    expect(configForDistance(60).id).toBe('extended');
    expect(configForDistance(150).id).toBe('twisted');
    expect(configForDistance(300).id).toBe('advanced');
  });
  it('is configurable', () => {
    const tiers = [{ ...DEFAULT_TIERS[0], from: 0, rules: 'twisted' }];
    expect(configForDistance(0, tiers).id).toBe('twisted');
  });
});

describe('determinism', () => {
  it('same seed reproduces the same world', () => {
    expect(strip(new WorldGenerator({ seed: 42 }), 30)).toBe(strip(new WorldGenerator({ seed: 42 }), 30));
  });
  it('different seeds differ', () => {
    expect(strip(new WorldGenerator({ seed: 1 }), 5)).not.toBe(strip(new WorldGenerator({ seed: 2 }), 5));
  });
  it('a manager reset with the same seed reproduces it', () => {
    const m = new ChunkManager({ seed: 7 });
    m.update(0);
    const first = JSON.stringify(m.getRow(0));
    m.update(60);
    m.reset();
    m.update(0);
    expect(JSON.stringify(m.getRow(0))).toBe(first);
  });
});

describe('chunks', () => {
  it('have ids, positions, tile counts and sequences', () => {
    const g = new WorldGenerator({ seed: 5, chunkRows: 6 });
    const a = g.generateChunk();
    const b = g.generateChunk();
    expect([a.id, b.id]).toEqual([0, 1]);
    expect(a.tileCount).toBe(6 * COLS);
    expect(b.firstRow).toBe(6);
    expect(b.zStart).toBeLessThan(a.zEnd); // further away than the previous chunk
    expect(a.rows).toHaveLength(6);
    expect(a.rows.every((r) => r.tiles.length === COLS)).toBe(true);
    a.dispose();
    expect(a.rows).toHaveLength(0);
    expect(a.active).toBe(false);
  });
});

describe('chunk window', () => {
  it('keeps current + 2 ahead + 1 behind and removes the rest', () => {
    const m = new ChunkManager({ seed: 3, chunkRows: 6, aheadChunks: 2, behindChunks: 1 });
    const first = m.update(0);
    expect(first.created.map((c) => c.id)).toEqual([0, 1, 2]);
    expect(m.update(3).created).toHaveLength(0); // same chunk: no work
    const next = m.update(6); // enter chunk 1
    expect(next.created.map((c) => c.id)).toEqual([3]);
    expect(next.removed).toHaveLength(0); // chunk 0 is the one behind
    const later = m.update(12); // enter chunk 2
    expect(later.removed.map((c) => c.id)).toEqual([0]);
    expect(later.removed[0].rows).toHaveLength(0); // disposed
    expect([...m.chunks.keys()].sort()).toEqual([1, 2, 3, 4]);
    expect(m.chunks.get(2)!.active).toBe(true);
    expect(m.chunks.get(1)!.active).toBe(false);
  });
  it('the behind count is configurable', () => {
    const m = new ChunkManager({ seed: 3, behindChunks: 3 });
    m.update(60);
    expect(m.liveChunks).toBe(3 + 1 + 2);
  });
  it('a big jump generates in order and keeps only the window', () => {
    const m = new ChunkManager({ seed: 3 });
    m.update(0);
    m.update(600); // chunk 100
    expect(m.liveChunks).toBe(4);
    expect(m.tryGetRow(600)).toBeDefined();
    expect(m.tryGetRow(0)).toBeUndefined();
    expect(() => m.getRow(0)).toThrow();
  });
  it('generates before the player reaches the end of the section', () => {
    const m = new ChunkManager({ seed: 9 });
    m.update(0);
    // From the first row of any chunk, the rows 11 ahead are already available.
    for (let row = 0; row < 120; row += 1) {
      m.update(row);
      expect(m.tryGetRow(row + 11)).toBeDefined();
    }
  });
});

describe('every generated world is solvable', () => {
  /** Independent check: follow ALL player states row by row. */
  function checkSeed(seed: number, rows: number) {
    const g = new WorldGenerator({ seed });
    const all = [] as ReturnType<WorldGenerator['generateChunk']>['rows'];
    while (all.length < rows) all.push(...g.generateChunk().rows);

    let reach = new Set<number | null>([null]);
    for (const spec of all) {
      const cfg = configForDistance(spec.row);
      if (spec.row === 0 || configForDistance(spec.row - 1).id !== cfg.id) reach = new Set([null]);
      expect(spec.configId).toBe(cfg.id);
      const next = new Set<number | null>();
      for (const p of reach) {
        let hasVisibleValid = false;
        for (const t of spec.tiles) {
          const r = validateSelection(p, t.color, { sequence: [] }, cfg);
          if (r.valid) {
            next.add(r.reset ? null : t.color);
            if (t.kind !== TileKind.Mystery) hasVisibleValid = true;
          }
        }
        if (!hasVisibleValid) throw new Error(`seed ${seed} row ${spec.row}: no path from state ${p}`);
      }
      expect(next.size).toBeGreaterThan(0);
      reach = next;
    }
  }
  it('has a visible valid tile for every reachable state (many seeds, 400 rows)', () => {
    for (let seed = 1; seed <= 25; seed++) checkSeed(seed, 400);
  });
  it('holds across every difficulty boundary and deep into the advanced tier', () => {
    checkSeed(777, 1500);
  });
  it('random legal players are never stuck', () => {
    const m = new ChunkManager({ seed: 99 });
    for (let player = 0; player < 40; player++) {
      let prev: number | null = null;
      for (let row = 0; row < 500; row++) {
        m.update(row);
        const spec = m.getRow(row);
        const cfg = m.rowConfig(row);
        if (row > 0 && m.rowConfig(row - 1).id !== cfg.id) prev = null;
        const valid = spec.tiles.filter(
          (t) => validateSelection(prev, t.color, { sequence: [] }, cfg).valid,
        );
        expect(valid.length).toBeGreaterThan(0);
        const pick = valid[(player * 31 + row * 7) % valid.length];
        const r = validateSelection(prev, pick.color, { sequence: [] }, cfg);
        prev = r.reset ? null : pick.color;
      }
      m.reset();
    }
  });
});

describe('specials and difficulty shape', () => {
  const rowsOf = (n: number) => {
    const g = new WorldGenerator({ seed: 11 });
    const out = [] as ReturnType<WorldGenerator['generateChunk']>['rows'];
    while (out.length < n) out.push(...g.generateChunk().rows);
    return out;
  };
  it('rewards appear, always on a tile valid for the reference path', () => {
    const rows = rowsOf(600);
    const rewards = rows.flatMap((r) => r.tiles.filter((t) => t.kind === TileKind.Reward).map((t) => [r, t] as const));
    expect(rewards.length).toBeGreaterThan(10);
    for (const [r, t] of rewards) {
      expect(validateSelection(r.star, t.color, { sequence: [] }, configForDistance(r.row)).valid).toBe(true);
    }
  });
  it('mystery tiles stay out of the first tier and never carry the cover', () => {
    const rows = rowsOf(600);
    const mystery = rows.flatMap((r) => r.tiles.filter((t) => t.kind === TileKind.Mystery).map((t) => [r, t] as const));
    expect(mystery.length).toBeGreaterThan(10);
    for (const [r, t] of mystery) {
      expect(r.row).toBeGreaterThanOrEqual(21);
      expect(t.protected).toBe(false);
    }
  });
  it('harder tiers offer fewer valid tiles for the reference path on average', () => {
    const rows = rowsOf(600);
    const avg = (from: number, to: number) => {
      const slice = rows.filter((r) => r.row >= from && r.row < to);
      const total = slice.reduce(
        (s, r) => s + r.tiles.filter((t) => validateSelection(r.star, t.color, { sequence: [] }, configForDistance(r.row)).valid).length,
        0,
      );
      return total / slice.length;
    };
    expect(avg(101, 600)).toBeLessThan(avg(0, 21));
  });
});

describe('long simulated session', () => {
  it('generates and removes chunks without leaks or slowdown', () => {
    const ROWS = 60000;
    const m = new ChunkManager({ seed: 2024 });
    const heapBefore = readHeapBytes();
    const maxLive = m.aheadChunks + m.behindChunks + 1;

    let maxSeen = 0;
    const times: number[] = [];
    for (let row = 0; row < ROWS; row++) {
      const t0 = performance.now();
      const upd = m.update(row);
      if (upd.created.length) times.push(performance.now() - t0);
      maxSeen = Math.max(maxSeen, m.liveChunks);

      // continuity: the rows the pool needs are always present
      expect(m.tryGetRow(row + 11)).toBeDefined();
      if (row > 0) expect(m.tryGetRow(row - 1)).toBeDefined();
    }

    expect(maxSeen).toBeLessThanOrEqual(maxLive);
    expect(m.stats.created).toBe(m.stats.removed + m.liveChunks);
    // work happened once per chunk, not once per frame
    expect(m.stats.work).toBeLessThanOrEqual(ROWS / m.chunkRows + 2);
    expect(m.stats.updates).toBe(ROWS);

    // no degradation: the last chunks cost about the same as the first
    const n = 300;
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const first = mean(times.slice(5, 5 + n)); // skip warm-up
    const last = mean(times.slice(-n));
    expect(last).toBeLessThan(first * 4 + 0.5);

    const heapAfter = readHeapBytes();
    if (heapBefore !== null && heapAfter !== null) {
      expect(heapAfter - heapBefore).toBeLessThan(150 * 1048576);
    }
  });
});

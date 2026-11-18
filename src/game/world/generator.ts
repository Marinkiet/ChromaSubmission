import { RULESETS } from '../configs.js';
import { DeceptionDirector } from '../deception/director.js';
import { RuleResolver } from '../deception/rule-switch.js';
import { DECEPTION_OFF } from '../deception/settings.js';
import type { DeceptionSettings } from '../deception/settings.js';
import { COLOR_COUNT, COLS } from '../palette.js';
import { validateSelection } from '../rules.js';
import type { ColorId, RuleConfig } from '../rules.js';
import { DEFAULT_TIERS, tierForDistance } from './difficulty.js';
import type { Tier } from './difficulty.js';
import { Rng, hashSeed } from './rng.js';
import { Chunk, Mod, TileKind } from './types.js';
import type { RowSpec, TileSpec } from './types.js';

export interface WorldOptions {
  seed: number;
  tiers?: readonly Tier[];
  configs?: Readonly<Record<string, RuleConfig>>;
  /** Deception mechanics. Omitted = none (the plain milestone 4 world). */
  deception?: DeceptionSettings;
  chunkRows?: number;
  aheadChunks?: number;
  behindChunks?: number;
}

type State = ColorId | null;
const NULL_KEY = -1;
const COLORS = Array.from({ length: COLOR_COUNT }, (_, i) => i);
const NO_CONTEXT = { sequence: [] as readonly ColorId[] };

/**
 * Builds the world one chunk at a time, in order, from a seed.
 *
 * Solvability guarantee: the generator tracks every colour state a player could
 * be in at each row (`reach`). Each row must offer a visible, non-mystery,
 * non-memory tile that is valid for EVERY such state, so no choice the player
 * makes can leave them without a valid move. Difficulty then shapes the decoys
 * around a reference path (`star`). Deception is layered on afterwards and
 * cannot remove those guaranteed tiles.
 */
export class WorldGenerator {
  readonly seed: number;
  readonly chunkRows: number;
  readonly resolver: RuleResolver;
  private tiers: readonly Tier[];
  private director: DeceptionDirector;
  private nextId = 0;
  private reach = new Set<number>([NULL_KEY]);
  private star: State = null;

  constructor(opts: WorldOptions) {
    this.seed = opts.seed >>> 0;
    this.tiers = opts.tiers ?? DEFAULT_TIERS;
    this.chunkRows = opts.chunkRows ?? 6;
    const deception = opts.deception ?? DECEPTION_OFF;
    this.resolver = new RuleResolver(
      this.tiers,
      opts.configs ?? RULESETS,
      deception.ruleSwitch.enabled ? deception.ruleSwitch.switches : [],
    );
    this.director = new DeceptionDirector(this.seed, deception);
  }

  get nextChunkId(): number {
    return this.nextId;
  }

  rowConfig(row: number): RuleConfig {
    return this.resolver.configAt(row);
  }

  generateChunk(): Chunk {
    const id = this.nextId++;
    const rng = new Rng(hashSeed(this.seed, id));
    const firstRow = id * this.chunkRows;
    const rows: RowSpec[] = [];
    for (let i = 0; i < this.chunkRows; i++) rows.push(this.generateRow(firstRow + i, rng));
    return new Chunk(id, firstRow, rows);
  }

  private generateRow(row: number, rng: Rng): RowSpec {
    const cfg = this.rowConfig(row);
    const tier = tierForDistance(row, this.tiers);
    const ok = (p: State, c: ColorId) => validateSelection(p, c, NO_CONTEXT, cfg).valid;

    // A new base rule set clears the player's sequence, so everyone starts fresh.
    // A rule switch keeps the sequence, so reachable states carry over.
    if (this.resolver.clearsSequenceAt(row)) {
      this.reach = new Set([NULL_KEY]);
      this.star = null;
    }
    const star = this.star;
    // Sorted so the result never depends on the order tiles were laid out in.
    const states: State[] = [...this.reach].sort((a, b) => a - b).map((k) => (k === NULL_KEY ? null : k));

    // 1. Cover: every reachable state gets at least one valid, visible tile.
    const tiles: TileSpec[] = [];
    for (const q of rng.shuffle(states)) {
      if (tiles.some((t) => ok(q, t.color))) continue;
      const cands = COLORS.filter((c) => ok(q, c));
      if (cands.length === 0) {
        throw new Error(`Rule set "${cfg.id}" has a dead end at state ${q} (row ${row})`);
      }
      // Prefer colours the reference path cannot use, which keeps rows harder.
      const pref = cands.filter((c) => !ok(star, c));
      tiles.push({
        color: rng.pick(pref.length ? pref : cands),
        kind: TileKind.Normal,
        mods: Mod.None,
        protected: true,
      });
    }

    // 2. Difficulty: aim for `validTarget` tiles valid for the reference path.
    const validForStar = COLORS.filter((c) => ok(star, c));
    let count = tiles.filter((t) => ok(star, t.color)).length;
    while (count < tier.validTarget && tiles.length < COLS && validForStar.length) {
      tiles.push({ color: rng.pick(validForStar), kind: TileKind.Normal, mods: Mod.None, protected: false });
      count++;
    }
    // 3. Decoys: colours that fail for the reference path.
    const decoys = COLORS.filter((c) => !ok(star, c));
    while (tiles.length < COLS) {
      tiles.push({
        color: rng.pick(decoys.length ? decoys : COLORS),
        kind: TileKind.Normal,
        mods: Mod.None,
        protected: false,
      });
    }
    let row7 = rng.shuffle(tiles);

    // 4. Special tiles. Cover tiles stay plain and visible.
    if (rng.chance(tier.rewardChance)) {
      const idx = row7.map((t, i) => (ok(star, t.color) ? i : -1)).filter((i) => i >= 0);
      if (idx.length) row7[rng.pick(idx)].kind = TileKind.Reward;
    }
    if (rng.chance(tier.mysteryChance)) {
      const idx = row7
        .map((t, i) => (!t.protected && t.kind === TileKind.Normal ? i : -1))
        .filter((i) => i >= 0);
      if (idx.length) {
        const t = row7[rng.pick(idx)];
        t.kind = TileKind.Mystery;
        t.color = rng.pick(COLORS); // hidden until chosen
      }
    }

    // The reference path takes its next step from the base row, before any
    // deception, so rearranging tiles can never change later rows.
    const movers = row7.filter((t) => t.kind !== TileKind.Mystery && ok(star, t.color));
    const step = validateSelection(star, rng.pick(movers).color, NO_CONTEXT, cfg);
    const nextStar: State = step.reset ? null : step.selected;

    // 4b. Deception. Uses its own random streams, so the base row above is unchanged.
    const deco = this.director.decorate(row, row7, star, ok);
    row7 = deco.tiles;

    // 5. Advance bookkeeping for the next row.
    const nextReach = new Set<number>();
    for (const p of states) {
      for (const t of row7) {
        const r = validateSelection(p, t.color, NO_CONTEXT, cfg);
        if (r.valid) nextReach.add(r.reset ? NULL_KEY : t.color);
      }
    }
    // A memory tile is judged against an earlier pick, so from any state it may
    // be accepted. Whatever it does, choosing it leaves the player in the state
    // of its own colour (or fresh, for a reset colour). Include those states.
    for (const t of row7) {
      if (t.mods & Mod.Memory) {
        const r = validateSelection(null, t.color, NO_CONTEXT, cfg);
        nextReach.add(r.reset ? NULL_KEY : t.color);
      }
    }
    const spec: RowSpec = {
      row,
      configId: cfg.id,
      tiles: row7,
      star,
      reachableStates: states.length,
      ...(deco.pattern ? { pattern: deco.pattern } : {}),
    };
    this.reach = nextReach;
    this.star = nextStar;
    return spec;
  }
}

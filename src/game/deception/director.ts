import { COLS } from '../palette.js';
import type { ColorId } from '../rules.js';
import { Rng, hashSeed } from '../world/rng.js';
import { Mod, TileKind } from '../world/types.js';
import type { TileSpec } from '../world/types.js';
import { DIFFICULTY_SCALE, INTRO_ROWS } from './settings.js';
import type { DeceptionSettings, MechanicId, MechanicSetting } from './settings.js';

type Valid = (p: ColorId | null, c: ColorId) => boolean;
const SALT: Record<string, number> = { shift: 0x51f7, mirror: 0x3a1c, memory: 0x7e2d, pattern: 0x1b9f };

/**
 * Adds deception to rows after the base row has been built. It only changes
 * `mods` and (for patterns) tile order, never a tile's colour or kind, and it
 * never touches the guaranteed-valid "cover" tiles' validity. Each mechanic
 * has its own random stream, so switching one on or off cannot change another.
 */
export class DeceptionDirector {
  private introduced = new Set<MechanicId>();
  private pat = {
    phase: 'idle' as 'idle' | 'lure' | 'break',
    k: 0,
    startCol: 0,
    dir: 1,
    rest: 0,
    wait: 0,
  };

  constructor(
    private seed: number,
    private settings: DeceptionSettings,
  ) {}

  private slots(id: 'shift' | 'mirror' | 'memory', row: number): number {
    const s: MechanicSetting = this.settings[id];
    if (!s.enabled || row < s.from) return 0;
    const rng = new Rng(hashSeed((this.seed ^ SALT[id]) >>> 0, row));
    const easing = row - s.from < INTRO_ROWS;
    const cap = easing ? 1 : s.maxPerRow;
    const p = s.chance * DIFFICULTY_SCALE[s.difficulty] * (easing ? 0.5 : 1);
    let n = 0;
    for (let i = 0; i < cap; i++) if (rng.chance(p)) n++;
    // Guaranteed introduction: first possible row at or after `from`.
    if (!this.introduced.has(id)) n = Math.max(1, n);
    return n;
  }

  /**
   * Returns the pattern label for the row and rearranges tiles for lures.
   * `star` is the reference path's colour state; `ok` is the rule check.
   */
  decorate(
    row: number,
    tiles: TileSpec[],
    star: ColorId | null,
    ok: Valid,
  ): { tiles: TileSpec[]; pattern?: 'lure' | 'break' } {
    const kinds = [
      ['shift', Mod.Shift, (t: TileSpec) => t.kind !== TileKind.Mystery],
      ['mirror', Mod.Mirror, (t: TileSpec) => t.kind !== TileKind.Mystery],
      // Memory changes how a tile is judged, so it can never be a cover tile.
      ['memory', Mod.Memory, (t: TileSpec) => !t.protected && t.kind === TileKind.Normal],
    ] as const;

    for (const [id, bit, eligible] of kinds) {
      const n = this.slots(id, row);
      if (n === 0) continue;
      const rng = new Rng(hashSeed((this.seed ^ SALT[id] ^ 0xabcd) >>> 0, row));
      const free = tiles.filter((t) => t.mods === Mod.None && eligible(t));
      const picks = rng.shuffle(free).slice(0, n);
      for (const t of picks) t.mods = bit;
      if (picks.length) this.introduced.add(id);
    }

    return this.layoutPattern(row, tiles, star, ok);
  }

  /** MECHANIC 5: lure the eye along a path, then break it. Colours are never hidden. */
  private layoutPattern(
    row: number,
    tiles: TileSpec[],
    star: ColorId | null,
    ok: Valid,
  ): { tiles: TileSpec[]; pattern?: 'lure' | 'break' } {
    const s = this.settings.pattern;
    if (!s.enabled || row < s.from) return { tiles };
    const rng = new Rng(hashSeed((this.seed ^ SALT.pattern) >>> 0, row));
    const st = this.pat;

    if (st.phase === 'idle') {
      if (st.rest > 0) {
        st.rest--;
        return { tiles };
      }
      const start = !this.introduced.has('pattern') || rng.chance(s.chance * DIFFICULTY_SCALE[s.difficulty]);
      if (!start) return { tiles };
      st.phase = 'lure';
      st.k = 0;
      st.startCol = rng.int(COLS);
      st.dir = rng.chance(0.5) ? 1 : -1;
      this.introduced.add('pattern');
    }

    const col = (k: number) => (((st.startCol + st.dir * k) % COLS) + COLS) % COLS;
    const swap = (a: number, b: number) => ([tiles[a], tiles[b]] = [tiles[b], tiles[a]]);

    // Valid-for-reference tiles that behave normally (not mystery, not memory).
    const anchors = () =>
      tiles
        .map((t, i) => (t.kind !== TileKind.Mystery && !(t.mods & Mod.Memory) && ok(star, t.color) ? i : -1))
        .filter((i) => i >= 0);

    if (st.phase === 'lure') {
      const a = anchors();
      if (a.length === 0) {
        st.phase = 'idle';
        return { tiles };
      }
      const target = col(st.k);
      // Prefer the anchor already closest, so little is rearranged.
      swap(a.includes(target) ? target : rng.pick(a), target);
      st.k++;
      if (st.k >= s.lureRows) st.phase = 'break';
      return { tiles, pattern: 'lure' };
    }

    // Break row: the predicted column holds a decoy, the way forward is elsewhere.
    const decoys = tiles
      .map((t, i) => (!ok(star, t.color) && t.kind !== TileKind.Mystery ? i : -1))
      .filter((i) => i >= 0);
    if (decoys.length === 0 && st.wait < 3) {
      // Nothing fails for the reference path here (e.g. right after a reset). Wait a row.
      st.wait++;
      st.k++; // the predicted path keeps advancing
      return { tiles };
    }
    const predicted = col(st.k);
    st.phase = 'idle';
    st.rest = 3;
    st.wait = 0;
    if (decoys.length === 0) return { tiles };
    swap(decoys.includes(predicted) ? predicted : rng.pick(decoys), predicted);
    return { tiles, pattern: 'break' };
  }
}

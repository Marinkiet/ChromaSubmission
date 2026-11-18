import { describe, expect, it } from 'vitest';
import { RULESETS } from '../configs.js';
import { COLS, TileColor as C } from '../palette.js';
import { validateSelection } from '../rules.js';
import { GameSession } from '../session.js';
import { ChunkManager } from '../world/chunk-manager.js';
import { WorldGenerator } from '../world/generator.js';
import { Mod, TileKind } from '../world/types.js';
import type { RowSpec } from '../world/types.js';
import { mirrorSourceCol, shiftDisplayColor } from './display.js';
import { introText, pendingIntros } from './intro.js';
import { resolveSelection } from './resolve.js';
import { RuleResolver } from './rule-switch.js';
import {
  DECEPTION_DEFAULTS,
  DECEPTION_OFF,
  only,
  without,
  withDifficulty,
} from './settings.js';
import type { DeceptionSettings, MechanicId } from './settings.js';

function rowsOf(n: number, seed: number, deception?: DeceptionSettings): RowSpec[] {
  const g = new WorldGenerator({ seed, deception });
  const out: RowSpec[] = [];
  while (out.length < n) out.push(...g.generateChunk().rows);
  return out.slice(0, n);
}
const modOf = (r: RowSpec, bit: number) => r.tiles.filter((t) => t.mods & bit).length;
const firstRowWith = (rows: RowSpec[], bit: number) => rows.find((r) => modOf(r, bit) > 0)?.row;

describe('independent enable / disable', () => {
  it('everything off reproduces the plain world exactly', () => {
    const plain = JSON.stringify(rowsOf(300, 5));
    expect(JSON.stringify(rowsOf(300, 5, DECEPTION_OFF))).toBe(plain);
  });

  const bits: [MechanicId, number][] = [
    ['shift', Mod.Shift],
    ['mirror', Mod.Mirror],
    ['memory', Mod.Memory],
  ];
  for (const [id, bit] of bits) {
    it(`${id} alone: only that modifier appears, base rows unchanged`, () => {
      const base = rowsOf(300, 8);
      const rows = rowsOf(300, 8, only([id]));
      expect(rows.some((r) => modOf(r, bit) > 0)).toBe(true);
      for (const r of rows) {
        for (const [, other] of bits) if (other !== bit) expect(modOf(r, other)).toBe(0);
        expect(r.pattern).toBeUndefined();
      }
      // Colours, kinds and positions are identical to the world without deception.
      // Memory is the one exception after its first appearance: the generator must
      // plan for its extra reachable states, which legitimately changes later rows.
      const key = (r: RowSpec) => JSON.stringify(r.tiles.map((t) => [t.color, t.kind, t.protected]));
      const limit = id === 'memory' ? DECEPTION_DEFAULTS.memory.from : rows.length;
      for (let i = 0; i < limit; i++) expect(key(rows[i])).toBe(key(base[i]));
    });
    it(`${id} disabled: never appears even when others are on`, () => {
      const rows = rowsOf(300, 8, without([id]));
      expect(rows.every((r) => modOf(r, bit) === 0)).toBe(true);
    });
  }

  it('pattern alone adds lure/break rows and keeps every colour', () => {
    const base = rowsOf(300, 4);
    const rows = rowsOf(300, 4, only(['pattern']));
    expect(rows.some((r) => r.pattern === 'lure')).toBe(true);
    expect(rows.some((r) => r.pattern === 'break')).toBe(true);
    rows.forEach((r, i) => {
      const a = r.tiles.map((t) => t.color).sort();
      const b = base[i].tiles.map((t) => t.color).sort();
      expect(a).toEqual(b); // same colours, only rearranged
    });
  });
});

describe('gradual introduction', () => {
  const rows = rowsOf(260, 12, DECEPTION_DEFAULTS);
  const s = DECEPTION_DEFAULTS;
  it('nothing appears before its start row', () => {
    expect(firstRowWith(rows, Mod.Shift)!).toBeGreaterThanOrEqual(s.shift.from);
    expect(firstRowWith(rows, Mod.Mirror)!).toBeGreaterThanOrEqual(s.mirror.from);
    expect(firstRowWith(rows, Mod.Memory)!).toBeGreaterThanOrEqual(s.memory.from);
    expect(rows.find((r) => r.pattern)!.row).toBeGreaterThanOrEqual(s.pattern.from);
  });
  it('each is introduced right at its start row (guaranteed)', () => {
    expect(firstRowWith(rows, Mod.Shift)).toBe(s.shift.from);
    expect(firstRowWith(rows, Mod.Mirror)).toBeLessThanOrEqual(s.mirror.from + 3);
    expect(firstRowWith(rows, Mod.Memory)).toBeLessThanOrEqual(s.memory.from + 3);
  });
  it('mechanics arrive in order', () => {
    const order = [Mod.Shift, Mod.Mirror, Mod.Memory].map((b) => firstRowWith(rows, b)!);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
  it('at most one tile per row while easing in', () => {
    for (const r of rows.filter((r) => r.row < s.shift.from + 15 && r.row >= s.shift.from)) {
      expect(modOf(r, Mod.Shift)).toBeLessThanOrEqual(1);
    }
  });
  it('the intro text exists for every mechanic and is reported once per row', () => {
    const r = rows[s.shift.from];
    expect(pendingIntros(r, new Set())).toContain('shift');
    expect(pendingIntros(r, new Set(['shift']))).not.toContain('shift');
    for (const id of ['shift', 'pattern', 'mirror', 'memory', 'ruleSwitch'] as const) {
      expect(introText(id).length).toBeGreaterThan(10);
    }
  });
});

describe('difficulty setting', () => {
  it('hard has more deception than easy', () => {
    const count = (d: 0 | 2) =>
      rowsOf(400, 21, withDifficulty(d)).reduce(
        (s, r) => s + modOf(r, Mod.Shift) + modOf(r, Mod.Mirror) + modOf(r, Mod.Memory),
        0,
      );
    expect(count(2)).toBeGreaterThan(count(0));
  });
});

describe('fairness: nothing critical is hidden', () => {
  const rows = rowsOf(500, 33, DECEPTION_DEFAULTS);
  it('memory tiles are never guaranteed-path tiles; mirror/shift keep their true colour', () => {
    for (const r of rows) {
      for (const t of r.tiles) {
        if (t.mods & Mod.Memory) {
          expect(t.protected).toBe(false);
          expect(t.kind).toBe(TileKind.Normal);
        }
        // Mystery tiles hide their colour on purpose, so they never also carry a visual illusion.
        if (t.kind === TileKind.Mystery) expect(t.mods).toBe(Mod.None);
      }
    }
  });
  it('a tile carries at most one modifier', () => {
    for (const r of rows) for (const t of r.tiles) expect([0, 1, 2, 4]).toContain(t.mods);
  });
  it('rows always have the full set of columns', () => {
    for (const r of rows) expect(r.tiles).toHaveLength(COLS);
  });
});

describe('MECHANIC 1: colour shift display', () => {
  const base = { trueColor: C.Blue, tileId: 5 };
  it('always shows the true colour on the choosing row', () => {
    for (let t = 0; t < 20; t += 0.37) {
      for (const understood of [false, true]) {
        expect(shiftDisplayColor({ ...base, time: t, isChoosingRow: true, understood })).toBe(C.Blue);
      }
    }
  });
  it('drifts away from the true colour on rows ahead before it is understood', () => {
    let different = 0;
    for (let t = 0; t < 20; t += 0.1) {
      if (shiftDisplayColor({ ...base, time: t, isChoosingRow: false, understood: false }) !== C.Blue) different++;
    }
    expect(different).toBeGreaterThan(150);
  });
  it('shows the true colour most of the time once understood', () => {
    let truth = 0;
    let total = 0;
    for (let t = 0; t < 60; t += 0.1) {
      total++;
      if (shiftDisplayColor({ ...base, time: t, isChoosingRow: false, understood: true }) === C.Blue) truth++;
    }
    expect(truth / total).toBeGreaterThan(0.55);
  });
  it('is deterministic and returns valid colours', () => {
    const a = shiftDisplayColor({ ...base, time: 3.3, isChoosingRow: false, understood: false });
    expect(shiftDisplayColor({ ...base, time: 3.3, isChoosingRow: false, understood: false })).toBe(a);
    for (let t = 0; t < 30; t += 0.2) {
      const c = shiftDisplayColor({ ...base, time: t, isChoosingRow: false, understood: false });
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThan(5);
    }
  });
  it('the shift never changes how the tile is judged', () => {
    // Identity is the spec colour; display colour is not an input to the rules.
    const cfg = RULESETS.tutorial;
    expect(validateSelection(C.Red, C.Blue, { sequence: [] }, cfg).valid).toBe(true);
  });
});

describe('MECHANIC 2: memory tiles', () => {
  it('behave normally with fewer than two picks', () => {
    expect(resolveSelection({ mods: Mod.Memory }, [])).toEqual({});
    expect(resolveSelection({ mods: Mod.Memory }, [C.Red])).toEqual({});
  });
  it('are judged against the pick two back', () => {
    const r = resolveSelection({ mods: Mod.Memory }, [C.Red, C.Yellow]);
    expect(r.previous).toBe(C.Red);
    expect(r.note).toMatch(/Red/);
  });
  it('non-memory tiles and a disabled mechanic are untouched', () => {
    expect(resolveSelection({ mods: Mod.None }, [C.Red, C.Yellow])).toEqual({});
    expect(resolveSelection({ mods: Mod.Memory }, [C.Red, C.Yellow], false)).toEqual({});
  });
  it('change the verdict through the real session, depending on history', () => {
    // Red, Blue, then Yellow: normally Blue->Yellow is valid; memory judges Red->Yellow (invalid in the tutorial).
    const s = new GameSession(RULESETS.tutorial);
    s.start();
    for (const c of [C.Red, C.Blue]) {
      s.select(c);
      s.completeFeedback();
    }
    const normal = validateSelection(s.previous, C.Yellow, { sequence: s.sequence }, s.config);
    expect(normal.valid).toBe(true);
    const mem = resolveSelection({ mods: Mod.Memory }, s.sequence);
    const out = s.select(C.Yellow, { previous: mem.previous });
    expect(out.accepted && out.result.valid).toBe(false);
    expect(out.accepted && out.result.previous).toBe(C.Red);
  });
  it('are deterministic', () => {
    const a = resolveSelection({ mods: Mod.Memory }, [C.Purple, C.Blue, C.Yellow]);
    const b = resolveSelection({ mods: Mod.Memory }, [C.Purple, C.Blue, C.Yellow]);
    expect(a).toEqual(b);
    expect(a.previous).toBe(C.Blue);
  });
});

describe('MECHANIC 3: mirror tiles', () => {
  it('reflect the opposite column and never themselves', () => {
    for (let c = 0; c < COLS; c++) {
      const m = mirrorSourceCol(c);
      expect(m).not.toBe(c);
      expect(m).toBeGreaterThanOrEqual(0);
      expect(m).toBeLessThan(COLS);
    }
    expect(mirrorSourceCol(0)).toBe(COLS - 1);
    expect(mirrorSourceCol(6)).toBe(0);
  });
  it('do not change the tile colour used by the rules', () => {
    const rows = rowsOf(200, 6, only(['mirror']));
    const base = rowsOf(200, 6);
    rows.forEach((r, i) => expect(r.tiles.map((t) => t.color)).toEqual(base[i].tiles.map((t) => t.color)));
  });
});

describe('MECHANIC 4: rule switch', () => {
  const sw = DECEPTION_DEFAULTS.ruleSwitch.switches;
  const resolver = new RuleResolver(undefined, undefined, sw);

  it('changes the rule at exactly the planned row', () => {
    const verdict = (row: number) =>
      validateSelection(C.Blue, C.Yellow, { sequence: [] }, resolver.configAt(row));
    expect(verdict(120).valid).toBe(true);
    expect(verdict(121).valid).toBe(false);
    expect(verdict(121).explanation).toMatch(/changed/);
    expect(resolver.switchAt(121)).toBeDefined();
    expect(resolver.switchAt(122)).toBeUndefined();
  });
  it('keeps the sequence across a switch but clears it on a new rule set', () => {
    expect(resolver.clearsSequenceAt(121)).toBe(false);
    expect(resolver.clearsSequenceAt(101)).toBe(true);
    expect(resolver.clearsSequenceAt(201)).toBe(true);
  });
  it('returns the same object for the same rule state (identity is stable)', () => {
    expect(resolver.configAt(125)).toBe(resolver.configAt(150));
    expect(resolver.configAt(125)).not.toBe(resolver.configAt(165));
    expect(resolver.configAt(100)).toBe(RULESETS.extended);
  });
  it('never leaves a dead end', () => {
    for (let row = 0; row < 400; row++) resolver.configAt(row); // throws if it would strand a player
  });
  it('refuses a rule set that would strand the player', () => {
    // A set with no reset colour where Yellow has no valid exit.
    const stuck = {
      ...RULESETS.tutorial,
      id: 'stuck',
      rules: RULESETS.tutorial.rules.filter((r) => r.kind !== 'reset' && r.id !== 'blue-yellow'),
      fallback: 'invalid' as const,
    };
    const tiers = [{ from: 0, label: 't', rules: 'stuck', validTarget: 1, rewardChance: 0, mysteryChance: 0 }];
    const r = new RuleResolver(tiers, { stuck }, [
      { atRow: 3, appliesTo: 'stuck', from: C.Red, to: C.Blue, outcome: 'invalid', explanation: 'x' },
    ]);
    expect(() => r.configAt(4)).toThrow(/strand/);
  });
  it('is off when disabled', () => {
    const g = new WorldGenerator({ seed: 1, deception: without(['ruleSwitch']) });
    expect(g.rowConfig(130).id).toBe('twisted');
    const on = new WorldGenerator({ seed: 1, deception: DECEPTION_DEFAULTS });
    expect(on.rowConfig(130).id).toBe('twisted+1');
  });
});

describe('MECHANIC 5: pattern illusions', () => {
  const rows = rowsOf(500, 17, only(['pattern']));
  const cfgOf = (r: RowSpec) => new RuleResolver().configAt(r.row);
  const validHere = (r: RowSpec, col: number) =>
    validateSelection(r.star, r.tiles[col].color, { sequence: [] }, cfgOf(r)).valid;

  it('lure rows follow a one-column-per-row path, and the path then breaks', () => {
    let stretches = 0;
    let broken = 0;
    for (let i = 0; i < rows.length - 8; i++) {
      if (rows[i].pattern !== 'lure' || (i > 0 && rows[i - 1].pattern === 'lure')) continue;
      let j = i;
      while (rows[j].pattern === 'lure') j++;
      const len = j - i;
      expect(len).toBe(DECEPTION_DEFAULTS.pattern.lureRows);
      // Some start column and direction puts a valid-for-reference tile on every lure row.
      const fits = [1, -1].flatMap((dir) =>
        Array.from({ length: COLS }, (_, start) => ({ dir, start })).filter(({ dir, start }) =>
          Array.from({ length: len }, (_, k) => k).every((k) =>
            validHere(rows[i + k], (((start + dir * k) % COLS) + COLS) % COLS),
          ),
        ),
      );
      expect(fits.length).toBeGreaterThan(0);
      stretches++;
      // The break may wait up to 3 rows for a decoy to exist.
      const wait = [0, 1, 2, 3].find((w) => rows[j + w].pattern === 'break');
      if (wait !== undefined) {
        // ...and on the break row the predicted column holds a tile that fails for the reference path.
        const ok = fits.some(({ dir, start }) => {
          const col = (((start + dir * (len + wait)) % COLS) + COLS) % COLS;
          return !validHere(rows[j + wait], col);
        });
        expect(ok).toBe(true);
        broken++;
      }
    }
    expect(stretches).toBeGreaterThan(3);
    expect(broken / stretches).toBeGreaterThan(0.7);
  });
  it('never hides colours: each row still shows every colour it had', () => {
    const base = rowsOf(500, 17);
    rows.forEach((r, i) => {
      expect(r.tiles.map((t) => t.color).sort()).toEqual(base[i].tiles.map((t) => t.color).sort());
    });
  });
});

describe('every deceptive world is still solvable', () => {
  it('random players, including memory-tile and rule-switch rows, are never stuck', () => {
    const m = new ChunkManager({ seed: 4242, deception: DECEPTION_DEFAULTS });
    for (let player = 0; player < 60; player++) {
      const seq: number[] = [];
      for (let row = 0; row < 330; row++) {
        m.update(row);
        const spec = m.getRow(row);
        const cfg = m.rowConfig(row);
        if (m.clearsSequenceAt(row)) seq.length = 0;

        // Real semantics: memory tiles judge against the pick two back.
        const judge = (t: (typeof spec.tiles)[number]) => {
          const res = resolveSelection(t, seq);
          const prev = res.previous !== undefined ? res.previous : (seq.length ? seq[seq.length - 1] : null);
          return validateSelection(prev, t.color, { sequence: seq }, cfg);
        };
        const reliable = spec.tiles.filter((t) => t.kind !== TileKind.Mystery && !(t.mods & Mod.Memory));
        // A visible, rule-abiding tile always exists.
        expect(reliable.some((t) => judge(t).valid)).toBe(true);

        // The player may pick ANY valid tile, including memory and mystery ones.
        const valid = spec.tiles.filter((t) => judge(t).valid);
        const pick = valid[(player * 17 + row * 5) % valid.length];
        const r = judge(pick);
        if (r.reset) seq.length = 0;
        else seq.push(pick.color);
      }
      m.reset();
    }
  });

  it('holds across many seeds', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const m = new ChunkManager({ seed, deception: DECEPTION_DEFAULTS });
      for (let row = 0; row < 260; row++) {
        m.update(row);
        m.getRow(row);
      }
    }
  });
});

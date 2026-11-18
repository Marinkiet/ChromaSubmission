import { describe, expect, it } from 'vitest';
import { TUTORIAL_CONFIG } from './configs.js';
import { COLOR_COUNT, TileColor as C } from './palette.js';
import { checkConfig, validateSelection } from './rules.js';
import type { RuleConfig } from './rules.js';

const v = (prev: number | null, sel: number, cfg: RuleConfig = TUTORIAL_CONFIG) =>
  validateSelection(prev, sel, { sequence: prev === null ? [] : [prev] }, cfg);

describe('tutorial transitions: every pair', () => {
  // Expected outcome written independently of the engine.
  const explicitValid = new Set([`${C.Red}>${C.Blue}`, `${C.Blue}>${C.Yellow}`]);
  const bonus = new Set([`${C.Purple}>${C.Blue}`]);

  for (let p = 0; p < COLOR_COUNT; p++) {
    for (let s = 0; s < COLOR_COUNT; s++) {
      const key = `${p}>${s}`;
      const expectValid = s === C.Green || explicitValid.has(key) || bonus.has(key);
      it(`${p} -> ${s} is ${expectValid ? 'valid' : 'invalid'}`, () => {
        const r = v(p, s);
        expect(r.valid).toBe(expectValid);
        expect(r.bonus).toBe(bonus.has(key) && s !== C.Green);
        expect(r.reset).toBe(s === C.Green);
        expect(r.explanation.length).toBeGreaterThan(0);
        expect(r.ruleId.length).toBeGreaterThan(0);
      });
    }
  }
});

describe('named rules', () => {
  it('Red -> Blue valid', () => {
    const r = v(C.Red, C.Blue);
    expect(r).toMatchObject({ valid: true, bonus: false, reset: false, ruleId: 'red-blue' });
  });
  it('Blue -> Yellow valid', () => {
    expect(v(C.Blue, C.Yellow)).toMatchObject({ valid: true, ruleId: 'blue-yellow' });
  });
  it('Yellow -> Red invalid with the explicit rule', () => {
    const r = v(C.Yellow, C.Red);
    expect(r).toMatchObject({ valid: false, ruleId: 'yellow-red' });
    expect(r.explanation).toMatch(/Yellow/);
  });
  it('Purple -> Blue is valid and awards the bonus', () => {
    const r = v(C.Purple, C.Blue);
    expect(r).toMatchObject({ valid: true, bonus: true, bonusPoints: 25, ruleId: 'purple-blue' });
  });
});

describe('reset', () => {
  it('Green resets from any previous colour', () => {
    for (let p = 0; p < COLOR_COUNT; p++) {
      expect(v(p, C.Green)).toMatchObject({ valid: true, reset: true, ruleId: 'green-reset' });
    }
  });
  it('Green as the first selection also counts as a reset', () => {
    expect(v(null, C.Green).reset).toBe(true);
  });
});

describe('consecutive identical colours', () => {
  it('are invalid by fallback with a clear explanation', () => {
    for (const c of [C.Red, C.Blue, C.Yellow, C.Purple]) {
      const r = v(c, c);
      expect(r.valid).toBe(false);
      expect(r.ruleId).toBe('fallback');
      expect(r.explanation).toMatch(/cannot follow itself/);
    }
  });
  it('become valid when a rule allows it', () => {
    const cfg: RuleConfig = {
      ...TUTORIAL_CONFIG,
      rules: [
        { id: 'rr', kind: 'transition', from: C.Red, to: C.Red, outcome: 'valid', explanation: 'Red repeats.' },
      ],
    };
    expect(v(C.Red, C.Red, cfg)).toMatchObject({ valid: true, ruleId: 'rr' });
  });
});

describe('missing previous selection', () => {
  it('any colour may start when start is "any"', () => {
    for (const c of [C.Red, C.Blue, C.Yellow, C.Purple]) {
      expect(v(null, c)).toMatchObject({ valid: true, ruleId: 'start' });
    }
  });
  it('a restricted start list rejects other colours with an explanation', () => {
    const cfg = { ...TUTORIAL_CONFIG, start: [C.Red] } as RuleConfig;
    expect(v(null, C.Red, cfg).valid).toBe(true);
    const bad = v(null, C.Blue, cfg);
    expect(bad).toMatchObject({ valid: false, ruleId: 'start' });
    expect(bad.explanation).toMatch(/Red/);
  });
  it('rejects unknown colour ids', () => {
    expect(() => v(null, 9)).toThrow(RangeError);
    expect(() => v(9, C.Red)).toThrow(RangeError);
  });
});

describe('rule configuration changes', () => {
  it('flipping a rule changes the verdict', () => {
    const flipped: RuleConfig = {
      ...TUTORIAL_CONFIG,
      rules: TUTORIAL_CONFIG.rules.map((r) =>
        r.id === 'red-blue' && r.kind === 'transition' ? { ...r, outcome: 'invalid' as const } : r,
      ),
    };
    expect(v(C.Red, C.Blue).valid).toBe(true);
    expect(v(C.Red, C.Blue, flipped).valid).toBe(false);
  });
  it('a permissive fallback accepts unmentioned pairs', () => {
    const cfg: RuleConfig = { ...TUTORIAL_CONFIG, fallback: 'valid' };
    expect(v(C.Red, C.Yellow, cfg)).toMatchObject({ valid: true, ruleId: 'fallback' });
    expect(v(C.Yellow, C.Red, cfg).valid).toBe(false); // explicit rule still wins
  });
  it('custom bonus points are respected', () => {
    const cfg: RuleConfig = {
      ...TUTORIAL_CONFIG,
      rules: [
        { id: 'big', kind: 'transition', from: C.Red, to: C.Blue, outcome: 'bonus', bonusPoints: 100, explanation: 'Big!' },
      ],
    };
    expect(v(C.Red, C.Blue, cfg).bonusPoints).toBe(100);
  });
  it('checkConfig accepts the tutorial and flags bad configs', () => {
    expect(checkConfig(TUTORIAL_CONFIG)).toEqual([]);
    const bad: RuleConfig = {
      ...TUTORIAL_CONFIG,
      start: [],
      rules: [
        { id: 'a', kind: 'transition', from: 0, to: 1, outcome: 'valid', explanation: '' },
        { id: 'a', kind: 'transition', from: 0, to: 1, outcome: 'valid', explanation: '' },
      ],
    };
    expect(checkConfig(bad).length).toBeGreaterThanOrEqual(3);
  });
});

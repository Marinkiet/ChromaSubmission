/**
 * CHROMA rule engine: configuration model and the pure validation function.
 * No rendering, no IWSDK, no three.js.
 *
 * Evaluation order for a selection:
 *   1. reset rule for the selected colour   (e.g. Green)
 *   2. start rule when there is no previous (a sequence must open legally)
 *   3. first transition rule matching previous -> selected
 *   4. fallback (a pair no rule mentions)
 * Every outcome carries a ruleId and an explanation, so no failure is arbitrary.
 */

import { COLOR_COUNT } from './palette.js';

export type ColorId = number;
export type Outcome = 'valid' | 'invalid' | 'bonus';

export const COLOR_NAMES = ['Red', 'Blue', 'Yellow', 'Green', 'Purple'] as const;
export const colorName = (c: ColorId): string => COLOR_NAMES[c] ?? `Color ${c}`;

export interface TransitionRule {
  id: string;
  kind: 'transition';
  from: ColorId;
  to: ColorId;
  outcome: Outcome;
  /** Extra points for outcome 'bonus'. Defaults to config.points.bonus. */
  bonusPoints?: number;
  /** Shown to the player once the rule fires. */
  explanation: string;
}

export interface ResetRule {
  id: string;
  kind: 'reset';
  color: ColorId;
  explanation: string;
}

export type Rule = TransitionRule | ResetRule;

export interface RuleConfig {
  id: string;
  name: string;
  rules: readonly Rule[];
  /** Colours allowed to open a sequence (no previous selection). */
  start: 'any' | readonly ColorId[];
  /** Outcome for a pair that no rule mentions. */
  fallback: 'valid' | 'invalid';
  startingLives: number;
  points: { valid: number; bonus: number; reward?: number };
}

/** What the validator needs to know about the game. */
export interface RuleContext {
  /** Colours chosen since the last reset (valid selections only). */
  sequence: readonly ColorId[];
}

export interface SelectionResult {
  valid: boolean;
  bonus: boolean;
  bonusPoints: number;
  reset: boolean;
  /** Rule that decided this: a rule id, or 'start' / 'fallback'. */
  ruleId: string;
  explanation: string;
  previous: ColorId | null;
  selected: ColorId;
}

function assertColor(c: ColorId): void {
  if (!Number.isInteger(c) || c < 0 || c >= COLOR_COUNT) {
    throw new RangeError(`Unknown colour id: ${c}`);
  }
}

export function validateSelection(
  previous: ColorId | null,
  selected: ColorId,
  _state: RuleContext,
  config: RuleConfig,
): SelectionResult {
  assertColor(selected);
  if (previous !== null) assertColor(previous);

  const base = { previous, selected, bonus: false, bonusPoints: 0, reset: false };

  // 1. Reset rules win over everything.
  for (const rule of config.rules) {
    if (rule.kind === 'reset' && rule.color === selected) {
      return { ...base, valid: true, reset: true, ruleId: rule.id, explanation: rule.explanation };
    }
  }

  // 2. Opening a sequence.
  if (previous === null) {
    const ok = config.start === 'any' || config.start.includes(selected);
    if (ok) {
      return {
        ...base,
        valid: true,
        ruleId: 'start',
        explanation: `${colorName(selected)} starts a new sequence.`,
      };
    }
    const allowed = (config.start as readonly ColorId[]).map(colorName).join(' or ');
    return {
      ...base,
      valid: false,
      ruleId: 'start',
      explanation: `A sequence can only begin with ${allowed}.`,
    };
  }

  // 3. Explicit transition rule.
  for (const rule of config.rules) {
    if (rule.kind === 'transition' && rule.from === previous && rule.to === selected) {
      const bonus = rule.outcome === 'bonus';
      return {
        ...base,
        valid: rule.outcome !== 'invalid',
        bonus,
        bonusPoints: bonus ? (rule.bonusPoints ?? config.points.bonus) : 0,
        ruleId: rule.id,
        explanation: rule.explanation,
      };
    }
  }

  // 4. Fallback for unmentioned pairs.
  const valid = config.fallback === 'valid';
  const same = previous === selected;
  return {
    ...base,
    valid,
    ruleId: 'fallback',
    explanation: valid
      ? `${colorName(previous)} can lead to ${colorName(selected)}.`
      : same
        ? `${colorName(selected)} cannot follow itself.`
        : `${colorName(previous)} does not lead to ${colorName(selected)}.`,
  };
}

/**
 * Colour states (null = fresh sequence) from which NO colour is valid. A config
 * with dead ends can strand the player, so generation refuses to use it.
 */
export function deadEnds(config: RuleConfig): (ColorId | null)[] {
  const states: (ColorId | null)[] = [null];
  for (let c = 0; c < COLOR_COUNT; c++) states.push(c);
  return states.filter((p) => {
    for (let c = 0; c < COLOR_COUNT; c++) {
      if (validateSelection(p, c, { sequence: [] }, config).valid) return false;
    }
    return true;
  });
}

/** Returns a list of problems with a config; empty means it is sound. */
export function checkConfig(config: RuleConfig): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const pairs = new Set<string>();
  const inRange = (c: ColorId) => Number.isInteger(c) && c >= 0 && c < COLOR_COUNT;
  for (const r of config.rules) {
    if (r.id === 'start' || r.id === 'fallback') problems.push(`Reserved rule id: ${r.id}`);
    if (ids.has(r.id)) problems.push(`Duplicate rule id: ${r.id}`);
    ids.add(r.id);
    if (r.kind === 'reset') {
      if (!inRange(r.color)) problems.push(`Rule ${r.id}: bad colour`);
    } else {
      if (!inRange(r.from) || !inRange(r.to)) problems.push(`Rule ${r.id}: bad colour`);
      const key = `${r.from}>${r.to}`;
      if (pairs.has(key)) problems.push(`Rule ${r.id}: duplicate pair ${key}`);
      pairs.add(key);
    }
  }
  if (config.start !== 'any' && config.start.length === 0) {
    problems.push('start list is empty: no sequence could ever begin');
  }
  if (config.startingLives < 1) problems.push('startingLives must be at least 1');
  const stuck = deadEnds(config);
  if (stuck.length) problems.push(`dead-end states with no valid colour: ${stuck.join(',')}`);
  return problems;
}

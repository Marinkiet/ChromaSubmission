import { TileColor as C } from '../palette.js';
import type { RuleSwitch } from './rule-switch.js';

export type MechanicId = 'shift' | 'mirror' | 'memory' | 'pattern' | 'ruleSwitch';
export const MECHANIC_IDS: readonly MechanicId[] = ['shift', 'pattern', 'mirror', 'memory', 'ruleSwitch'];

/** 0 = gentle, 1 = normal, 2 = hard. Scales how often a mechanic shows up. */
export type DifficultySetting = 0 | 1 | 2;
export const DIFFICULTY_SCALE = [0.5, 1, 1.6] as const;

export interface MechanicSetting {
  enabled: boolean;
  /** First row where the mechanic may appear. It is guaranteed to be introduced there. */
  from: number;
  /** Chance per candidate slot, before difficulty scaling. */
  chance: number;
  /** Most tiles per row once the introduction phase is over. */
  maxPerRow: number;
  difficulty: DifficultySetting;
}

export interface PatternSetting extends MechanicSetting {
  /** Rows that follow the predictable path before the break row. */
  lureRows: number;
}

export interface RuleSwitchSetting {
  enabled: boolean;
  difficulty: DifficultySetting;
  switches: readonly RuleSwitch[];
}

export interface DeceptionSettings {
  shift: MechanicSetting;
  pattern: PatternSetting;
  mirror: MechanicSetting;
  memory: MechanicSetting;
  ruleSwitch: RuleSwitchSetting;
}

/** Rows after `from` during which a mechanic is eased in: one tile at most, rarer. */
export const INTRO_ROWS = 15;

/** DECEIVE begins at row 51. Mechanics arrive one at a time. */
export const DECEPTION_DEFAULTS: DeceptionSettings = {
  shift: { enabled: true, from: 51, chance: 0.3, maxPerRow: 2, difficulty: 1 },
  pattern: { enabled: true, from: 61, chance: 0.25, maxPerRow: 1, difficulty: 1, lureRows: 4 },
  mirror: { enabled: true, from: 76, chance: 0.2, maxPerRow: 2, difficulty: 1 },
  memory: { enabled: true, from: 91, chance: 0.2, maxPerRow: 1, difficulty: 1 },
  ruleSwitch: {
    enabled: true,
    difficulty: 1,
    switches: [
      {
        atRow: 121,
        appliesTo: 'twisted',
        from: C.Blue,
        to: C.Yellow,
        outcome: 'invalid',
        explanation: 'Blue no longer flows into Yellow. That rule has changed.',
      },
      {
        atRow: 161,
        appliesTo: 'twisted',
        from: C.Purple,
        to: C.Yellow,
        outcome: 'invalid',
        explanation: 'Purple no longer glows into Yellow. That rule has changed.',
      },
    ],
  },
};

/** Everything off: the world is exactly the milestone 4 world. */
export const DECEPTION_OFF: DeceptionSettings = {
  shift: { ...DECEPTION_DEFAULTS.shift, enabled: false },
  pattern: { ...DECEPTION_DEFAULTS.pattern, enabled: false },
  mirror: { ...DECEPTION_DEFAULTS.mirror, enabled: false },
  memory: { ...DECEPTION_DEFAULTS.memory, enabled: false },
  ruleSwitch: { ...DECEPTION_DEFAULTS.ruleSwitch, enabled: false },
};

/** Defaults with the listed mechanics turned off. */
export function without(ids: readonly MechanicId[], base = DECEPTION_DEFAULTS): DeceptionSettings {
  const out = { ...base };
  for (const id of ids) out[id] = { ...out[id], enabled: false } as never;
  return out;
}

/** Only the listed mechanics turned on. */
export function only(ids: readonly MechanicId[], base = DECEPTION_DEFAULTS): DeceptionSettings {
  return without(
    MECHANIC_IDS.filter((id) => !ids.includes(id)),
    base,
  );
}

/** Applies one difficulty to every mechanic. */
export function withDifficulty(d: DifficultySetting, base = DECEPTION_DEFAULTS): DeceptionSettings {
  return {
    shift: { ...base.shift, difficulty: d },
    pattern: { ...base.pattern, difficulty: d },
    mirror: { ...base.mirror, difficulty: d },
    memory: { ...base.memory, difficulty: d },
    ruleSwitch: { ...base.ruleSwitch, difficulty: d },
  };
}

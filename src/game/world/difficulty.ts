import { RULESETS } from '../configs.js';
import type { RuleConfig } from '../rules.js';

/** One step of the difficulty curve. Edit this table to retune the game. */
export interface Tier {
  /** First row (distance) at which this tier applies. */
  from: number;
  label: string;
  /** Which rule set is active (key into RULESETS). */
  rules: string;
  /** Target number of tiles in a row that are valid for the reference player. Lower = harder. */
  validTarget: number;
  rewardChance: number;
  mysteryChance: number;
}

export const DEFAULT_TIERS: readonly Tier[] = [
  { from: 0, label: 'basic colour sequences', rules: 'tutorial', validTarget: 3, rewardChance: 0.1, mysteryChance: 0 },
  { from: 21, label: 'longer patterns', rules: 'tutorial', validTarget: 2, rewardChance: 0.1, mysteryChance: 0.05 },
  { from: 51, label: 'additional hidden rules', rules: 'extended', validTarget: 2, rewardChance: 0.12, mysteryChance: 0.1 },
  { from: 101, label: 'complex combinations', rules: 'twisted', validTarget: 1, rewardChance: 0.12, mysteryChance: 0.15 },
  { from: 201, label: 'advanced challenge', rules: 'advanced', validTarget: 1, rewardChance: 0.15, mysteryChance: 0.2 },
];

export function tierForDistance(distance: number, tiers: readonly Tier[] = DEFAULT_TIERS): Tier {
  let found = tiers[0];
  for (const t of tiers) {
    if (distance >= t.from) found = t;
    else break;
  }
  return found;
}

export function configForDistance(
  distance: number,
  tiers: readonly Tier[] = DEFAULT_TIERS,
  sets: Readonly<Record<string, RuleConfig>> = RULESETS,
): RuleConfig {
  const set = sets[tierForDistance(distance, tiers).rules];
  if (!set) throw new Error(`Unknown rule set for distance ${distance}`);
  return set;
}

import { RULESETS } from '../configs.js';
import { deadEnds } from '../rules.js';
import type { ColorId, RuleConfig } from '../rules.js';
import { DEFAULT_TIERS, configForDistance } from '../world/difficulty.js';
import type { Tier } from '../world/difficulty.js';

/**
 * MECHANIC 4. A planned change to one transition rule.
 *
 * "After N successful selections" is the same as "at row N": every valid pick
 * advances exactly one row and failures do not. That makes the switch
 * deterministic, so the generator can plan rows around it.
 */
export interface RuleSwitch {
  atRow: number;
  /** Only applies while this base rule set is active (its id). */
  appliesTo: string;
  from: ColorId;
  to: ColorId;
  outcome: 'valid' | 'invalid' | 'bonus';
  /** Shown whenever the changed rule fires, so the change is learnable. */
  explanation: string;
}

function patch(base: RuleConfig, switches: readonly RuleSwitch[], id: string): RuleConfig {
  let rules = base.rules.slice();
  for (const s of switches) {
    let hit = false;
    rules = rules.map((r) => {
      if (r.kind === 'transition' && r.from === s.from && r.to === s.to) {
        hit = true;
        return { ...r, outcome: s.outcome, explanation: s.explanation };
      }
      return r;
    });
    if (!hit) {
      rules.push({
        id: `switch-${s.from}-${s.to}`,
        kind: 'transition',
        from: s.from,
        to: s.to,
        outcome: s.outcome,
        explanation: s.explanation,
      });
    }
  }
  const cfg: RuleConfig = { ...base, id, rules };
  const stuck = deadEnds(cfg);
  if (stuck.length) throw new Error(`Rule switch would strand the player in ${id}: ${stuck}`);
  return cfg;
}

/**
 * Maps a row to its active RuleConfig: the tier's base rule set plus any rule
 * switches that have happened. Results are cached, so the same row range
 * always returns the same object (callers may compare by identity).
 */
export class RuleResolver {
  private cache = new Map<string, RuleConfig>();

  constructor(
    private tiers: readonly Tier[] = DEFAULT_TIERS,
    private sets: Readonly<Record<string, RuleConfig>> = RULESETS,
    private switches: readonly RuleSwitch[] = [],
  ) {}

  baseAt(row: number): RuleConfig {
    return configForDistance(row, this.tiers, this.sets);
  }

  private appliedAt(row: number): RuleSwitch[] {
    const base = this.baseAt(row);
    return this.switches
      .filter((s) => row >= s.atRow && s.appliesTo === base.id)
      .sort((a, b) => a.atRow - b.atRow);
  }

  configAt(row: number): RuleConfig {
    const base = this.baseAt(row);
    const applied = this.appliedAt(row);
    if (applied.length === 0) return base;
    const id = `${base.id}+${applied.length}`;
    let cfg = this.cache.get(id);
    if (!cfg) {
      cfg = patch(base, applied, id);
      this.cache.set(id, cfg);
    }
    return cfg;
  }

  /** True when the player's sequence is cleared on entering this row (new base rule set). */
  clearsSequenceAt(row: number): boolean {
    return row === 0 || this.baseAt(row).id !== this.baseAt(row - 1).id;
  }

  /** The switch that takes effect exactly at this row, if any. */
  switchAt(row: number): RuleSwitch | undefined {
    const base = this.baseAt(row);
    return this.switches.find((s) => s.atRow === row && s.appliesTo === base.id);
  }
}

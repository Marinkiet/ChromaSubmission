import type { RuleConfig } from './rules.js';

/** Remembers which rules the player has triggered at least once. */
export class DiscoveryTracker {
  private counts = new Map<string, number>();

  /** Returns true when this is the first time the rule fired. */
  record(ruleId: string): boolean {
    const n = this.counts.get(ruleId) ?? 0;
    this.counts.set(ruleId, n + 1);
    return n === 0;
  }

  has(ruleId: string): boolean {
    return this.counts.has(ruleId);
  }

  count(ruleId: string): number {
    return this.counts.get(ruleId) ?? 0;
  }

  /** Discovered ids in the order they were first found. */
  discovered(): string[] {
    return [...this.counts.keys()];
  }

  /** Configured rules the player has not triggered yet. */
  undiscovered(config: RuleConfig): string[] {
    return config.rules.map((r) => r.id).filter((id) => !this.counts.has(id));
  }

  clear(): void {
    this.counts.clear();
  }
}

import type { DiscoveryTracker } from './discovery.js';
import { colorName } from './rules.js';
import type { RuleConfig } from './rules.js';

/**
 * A gentle nudge about the first rule the player has not triggered yet.
 * Points at where to experiment without stating the rule.
 */
export function nextClue(config: RuleConfig, discovery: DiscoveryTracker): string {
  const id = discovery.undiscovered(config)[0];
  const rule = config.rules.find((r) => r.id === id);
  if (!rule) return 'You have uncovered every rule.';
  if (rule.kind === 'reset') {
    return 'One colour behaves differently on its own. Try them all.';
  }
  return `Something is hidden about what follows ${colorName(rule.from)}.`;
}

import { TileColor as C } from './palette.js';
import type { RuleConfig } from './rules.js';

/** Tutorial rule set. Rules are data: change them here, not in game code. */
export const TUTORIAL_CONFIG: RuleConfig = {
  id: 'tutorial',
  name: 'Tutorial',
  start: 'any',
  fallback: 'invalid',
  startingLives: 3,
  points: { valid: 10, bonus: 25 },
  rules: [
    {
      id: 'red-blue',
      kind: 'transition',
      from: C.Red,
      to: C.Blue,
      outcome: 'valid',
      explanation: 'Red flows into Blue.',
    },
    {
      id: 'blue-yellow',
      kind: 'transition',
      from: C.Blue,
      to: C.Yellow,
      outcome: 'valid',
      explanation: 'Blue flows into Yellow.',
    },
    {
      id: 'yellow-red',
      kind: 'transition',
      from: C.Yellow,
      to: C.Red,
      outcome: 'invalid',
      explanation: 'Yellow can never be followed by Red.',
    },
    {
      id: 'green-reset',
      kind: 'reset',
      color: C.Green,
      explanation: 'Green clears the sequence.',
    },
    {
      id: 'purple-blue',
      kind: 'transition',
      from: C.Purple,
      to: C.Blue,
      outcome: 'bonus',
      explanation: 'Purple into Blue is a bonus link!',
    },
  ],
};

/** Stage 2 (distance 51+): the tutorial rules plus three newly hidden links. */
export const EXTENDED_CONFIG: RuleConfig = {
  ...TUTORIAL_CONFIG,
  id: 'extended',
  name: 'Extended',
  rules: [
    ...TUTORIAL_CONFIG.rules,
    {
      id: 'blue-purple',
      kind: 'transition',
      from: C.Blue,
      to: C.Purple,
      outcome: 'valid',
      explanation: 'Blue deepens into Purple.',
    },
    {
      id: 'purple-yellow',
      kind: 'transition',
      from: C.Purple,
      to: C.Yellow,
      outcome: 'valid',
      explanation: 'Purple glows into Yellow.',
    },
    {
      id: 'red-purple',
      kind: 'transition',
      from: C.Red,
      to: C.Purple,
      outcome: 'invalid',
      explanation: 'Red and Purple clash.',
    },
  ],
};

/** Stage 3 (distance 101+): some earlier rules flip. Deception, but still logical. */
export const TWISTED_CONFIG: RuleConfig = {
  ...EXTENDED_CONFIG,
  id: 'twisted',
  name: 'Twisted',
  rules: [
    ...EXTENDED_CONFIG.rules.map((r) => {
      if (r.id === 'red-blue' && r.kind === 'transition') {
        return { ...r, outcome: 'invalid' as const, explanation: 'Red no longer flows into Blue.' };
      }
      if (r.id === 'yellow-red' && r.kind === 'transition') {
        return { ...r, outcome: 'valid' as const, explanation: 'Yellow now flows into Red.' };
      }
      return r;
    }),
    {
      id: 'red-yellow',
      kind: 'transition' as const,
      from: C.Red,
      to: C.Yellow,
      outcome: 'valid' as const,
      explanation: 'Red warms into Yellow.',
    },
  ],
};

/** Stage 4 (distance 201+): the reset colour moves from Green to Purple. */
export const ADVANCED_CONFIG: RuleConfig = {
  ...TWISTED_CONFIG,
  id: 'advanced',
  name: 'Advanced',
  rules: [
    ...TWISTED_CONFIG.rules.filter((r) => r.id !== 'green-reset' && r.id !== 'purple-blue'),
    {
      id: 'purple-reset',
      kind: 'reset' as const,
      color: C.Purple,
      explanation: 'Purple now clears the sequence.',
    },
    {
      id: 'green-blue',
      kind: 'transition' as const,
      from: C.Green,
      to: C.Blue,
      outcome: 'bonus' as const,
      explanation: 'Green into Blue is a bonus link!',
    },
  ],
};

export const RULESETS: Readonly<Record<string, RuleConfig>> = {
  tutorial: TUTORIAL_CONFIG,
  extended: EXTENDED_CONFIG,
  twisted: TWISTED_CONFIG,
  advanced: ADVANCED_CONFIG,
};

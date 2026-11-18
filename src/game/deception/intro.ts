import { Mod } from '../world/types.js';
import type { RowSpec } from '../world/types.js';
import type { MechanicId } from './settings.js';

/** The learnable explanation for each mechanic, shown the first time it is the player's turn. */
export const INTRO_TEXT: Record<Exclude<MechanicId, 'ruleSwitch'>, string> = {
  shift: 'Tiles ahead may drift in colour. They settle to their true colour on your turn.',
  pattern: 'A path of tiles can look like a pattern. Patterns break. Trust the colours.',
  mirror: 'Shiny tiles show a reflection of the far side. The tile itself is its real colour.',
  memory: 'Ringed tiles remember: they look back two picks instead of one.',
};

const MOD_TO_ID: [number, keyof typeof INTRO_TEXT][] = [
  [Mod.Shift, 'shift'],
  [Mod.Mirror, 'mirror'],
  [Mod.Memory, 'memory'],
];

/** Mechanics present on this row that the player has not been told about yet. */
export function pendingIntros(row: RowSpec, introduced: ReadonlySet<string>): MechanicId[] {
  const found: MechanicId[] = [];
  for (const [bit, id] of MOD_TO_ID) {
    if (!introduced.has(id) && row.tiles.some((t) => t.mods & bit)) found.push(id);
  }
  if (row.pattern && !introduced.has('pattern')) found.push('pattern');
  return found;
}

export function introText(id: MechanicId): string {
  return id === 'ruleSwitch' ? 'A rule has changed.' : INTRO_TEXT[id];
}

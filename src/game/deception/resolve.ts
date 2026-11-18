import { colorName } from '../rules.js';
import type { ColorId } from '../rules.js';
import { Mod } from '../world/types.js';

export interface PickInfo {
  mods: number;
}

export interface Resolution {
  /**
   * Passed to the rule engine as the "previous" colour. undefined = normal
   * behaviour (use the real previous selection).
   */
  previous?: ColorId | null;
  /** Extra sentence appended to the feedback so the behaviour is learnable. */
  note?: string;
}

/**
 * MECHANIC 2: MEMORY. A memory tile looks one step further back than a normal
 * tile: it is judged against the pick BEFORE the last one. With fewer than two
 * picks in the chain it behaves like any other tile.
 *
 * Deterministic: depends only on the tile and the current sequence.
 */
export function resolveSelection(
  tile: PickInfo,
  sequence: readonly ColorId[],
  memoryEnabled = true,
): Resolution {
  if (memoryEnabled && tile.mods & Mod.Memory && sequence.length >= 2) {
    const remembered = sequence[sequence.length - 2];
    return {
      previous: remembered,
      note: `Memory tile: judged against ${colorName(remembered)}, two picks back.`,
    };
  }
  return {};
}

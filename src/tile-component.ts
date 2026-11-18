import { createComponent, Types } from '@iwsdk/core';

/** Data for one pooled tile. Behaviour lives in systems. */
export const Tile = createComponent('Tile', {
  tileId: { type: Types.Int32, default: 0 },
  col: { type: Types.Int32, default: 0 },
  row: { type: Types.Int32, default: 0 },
  colorIndex: { type: Types.Int32, default: 0 },
  kind: { type: Types.Int32, default: 0 }, // TileKind: normal, reward, mystery
  mods: { type: Types.Int32, default: 0 }, // Mod flags: shift, mirror, memory
  decoy: { type: Types.Int32, default: 0 }, // colour shown by a mirror tile's reflection
  revealed: { type: Types.Boolean, default: false }, // mystery colour shown
  state: { type: Types.Int32, default: 0 }, // TileState
  hovered: { type: Types.Boolean, default: false },
  pulse: { type: Types.Float32, default: 0 }, // 1 -> 0 feedback animation
});

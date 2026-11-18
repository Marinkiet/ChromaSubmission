import type { Entity } from '@iwsdk/core';
import { TileState } from './game/palette.js';
import { mirrorSourceCol } from './game/deception/display.js';
import { chunks } from './game/instance.js';
import { Tile } from './tile-component.js';

/** Points a pooled tile at a world row: copies colour and kind from the chunk data. */
export function bindTileToRow(entity: Entity, row: number): void {
  const col = entity.getValue(Tile, 'col')!;
  const spec = chunks.getRow(row).tiles[col];
  entity.setValue(Tile, 'row', row);
  entity.setValue(Tile, 'colorIndex', spec.color);
  entity.setValue(Tile, 'kind', spec.kind);
  entity.setValue(Tile, 'mods', spec.mods);
  entity.setValue(Tile, 'decoy', chunks.getRow(row).tiles[mirrorSourceCol(col)].color);
  entity.setValue(Tile, 'revealed', false);
  entity.setValue(Tile, 'state', TileState.Idle);
  entity.setValue(Tile, 'pulse', 0);
}

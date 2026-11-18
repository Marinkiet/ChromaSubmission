import { Mesh, RayInteractable, World } from '@iwsdk/core';
import { chunks } from './game/instance.js';
import { COLS, ROWS, TILE_THICKNESS } from './game/palette.js';
import { bindTileToRow } from './tile-data.js';
import { Tile } from './tile-component.js';
import {
  gemGeometry,
  gemMaterial,
  reflectionGeometry,
  reflectionMaterials,
  ringGeometry,
  ringMaterial,
  tileGeometry,
  tileMaterials,
} from './tile-materials.js';

/** Small meshes attached to every pooled tile and shown only when needed. */
export interface TileMarkers {
  gem: Mesh;
  reflection: Mesh;
  ring: Mesh;
}

/**
 * Creates the fixed pool of tile entities. They are recycled as the player
 * advances and never destroyed, so no per-chunk GPU resources exist. Markers
 * share geometry and materials; hidden ones cost no draw calls.
 */
export function createTileGrid(world: World): void {
  chunks.update(0);
  let id = 0;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const mesh = new Mesh(tileGeometry, tileMaterials[0][0]);

      const gem = new Mesh(gemGeometry, gemMaterial); // reward
      gem.position.y = 0.06;
      const reflection = new Mesh(reflectionGeometry, reflectionMaterials[0]); // mirror
      reflection.position.set(0, TILE_THICKNESS / 2 + 0.003, 0.07); // front edge, facing the player
      const ring = new Mesh(ringGeometry, ringMaterial); // memory
      ring.rotation.x = Math.PI / 2;
      ring.position.y = TILE_THICKNESS / 2 + 0.004;
      for (const m of [gem, reflection, ring]) {
        m.visible = false;
        mesh.add(m);
      }
      mesh.userData.markers = { gem, reflection, ring } satisfies TileMarkers;

      const entity = world
        .createTransformEntity(mesh)
        .addComponent(Tile, { tileId: id++, col })
        // Pointer ray / hand pinch target.
        .addComponent(RayInteractable);
      bindTileToRow(entity, row);
    }
  }
}

import {
  BoxGeometry,
  Color,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  TorusGeometry,
} from '@iwsdk/core';
import {
  COLOR_COUNT,
  PALETTE,
  STATE_COUNT,
  TILE_SIZE,
  TILE_THICKNESS,
} from './game/palette.js';

/** One geometry shared by every tile. */
export const tileGeometry = new BoxGeometry(TILE_SIZE, TILE_THICKNESS, TILE_SIZE);

// Emissive strength per TileState: Idle, Highlighted, Selected.
const EMISSIVE = [0.55, 1.5, 2.8];

/** 5 colours x 3 states of shared materials with the given surface finish. */
function buildSet(roughness: number, metalness: number): MeshStandardMaterial[][] {
  return Array.from({ length: COLOR_COUNT }, (_, c) =>
    Array.from({ length: STATE_COUNT }, (_, s) => {
      const base = new Color(PALETTE[c]);
      return new MeshStandardMaterial({
        color: base.clone().multiplyScalar(0.45),
        emissive: base,
        emissiveIntensity: EMISSIVE[s],
        roughness,
        metalness,
      });
    }),
  );
}

/** Swapping a tile's material is cheaper than mutating one, and never affects other tiles. */
export const tileMaterials = buildSet(0.28, 0.15);

/** Mirror tiles: the same colours, but glossy and reflective-looking. */
export const mirrorMaterials = buildSet(0.04, 0.85);

/** Mystery tiles hide their colour: a pale silver tile, 3 shared state materials. */
export const mysteryMaterials: MeshStandardMaterial[] = EMISSIVE.map(
  (intensity) =>
    new MeshStandardMaterial({
      color: new Color(0xc9d0e8).multiplyScalar(0.5),
      emissive: new Color(0xaab4e8),
      emissiveIntensity: intensity * 0.5,
      roughness: 0.2,
      metalness: 0.4,
    }),
);

/** Reward marker: a small gold gem shared by every reward tile. */
export const gemGeometry = new OctahedronGeometry(0.035, 0);
export const gemMaterial = new MeshBasicMaterial({ color: 0xffd95d, toneMapped: false });

/** Mirror reflection bar: shows the opposite tile's colour. One material per colour. */
export const reflectionGeometry = new BoxGeometry(TILE_SIZE * 0.7, 0.004, 0.03);
export const reflectionMaterials = PALETTE.map(
  (hex) => new MeshBasicMaterial({ color: hex, toneMapped: false }),
);

/** Memory ring: a thin white ring around the tile top. */
export const ringGeometry = new TorusGeometry(TILE_SIZE * 0.34, 0.006, 6, 24);
export const ringMaterial = new MeshBasicMaterial({ color: 0xffffff, toneMapped: false });

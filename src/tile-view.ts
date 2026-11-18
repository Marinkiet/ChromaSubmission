import {
  BoxGeometry,
  Color,
  FogExp2,
  Mesh,
  MeshBasicMaterial,
  createSystem,
} from '@iwsdk/core';
import { shiftDisplayColor } from './game/deception/display.js';
import { introduced, ui } from './game/instance.js';
import {
  COLS,
  NEAR_Z,
  TABLE_Y,
  TILE_PITCH,
  TILE_SIZE,
  TILE_THICKNESS,
  TileState,
} from './game/palette.js';
import { track } from './game/track.js';
import { Mod, TileKind } from './game/world/types.js';
import { Tile } from './tile-component.js';
import type { TileMarkers } from './tile-factory.js';
import {
  mirrorMaterials,
  mysteryMaterials,
  reflectionMaterials,
  tileMaterials,
} from './tile-materials.js';

const LIFT = 0.02; // a targeted tile rises slightly
const FOG_BASE = new Color(0x03030a);
const FOG_FLASH = new Color(0x6a1a8a);

/** Rendering only: turns Tile data into position, material and animation. */
export class TileViewSystem extends createSystem({
  tiles: { required: [Tile] },
}) {
  private outline!: Mesh;

  init(): void {
    // One shared glowing border, moved to whichever tile is targeted.
    this.outline = new Mesh(
      new BoxGeometry(TILE_SIZE + 0.016, TILE_THICKNESS * 0.6, TILE_SIZE + 0.016),
      new MeshBasicMaterial({ color: 0xffffff, toneMapped: false, fog: false }),
    );
    this.outline.visible = false;
    this.scene.add(this.outline);
  }

  update(_delta: number, time: number): void {
    const shiftUnderstood = introduced.has('shift');
    let targeted: Mesh | null = null;

    for (const e of this.queries.tiles.entities) {
      const mesh = e.object3D as Mesh | undefined;
      if (!mesh) continue;
      const col = e.getValue(Tile, 'col')!;
      const row = e.getValue(Tile, 'row')!;
      const pulse = e.getValue(Tile, 'pulse')!;
      const state = e.getValue(Tile, 'state')!;
      const kind = e.getValue(Tile, 'kind')!;
      const mods = e.getValue(Tile, 'mods')!;
      const trueColor = e.getValue(Tile, 'colorIndex')!;

      const lift = state === TileState.Highlighted ? LIFT : 0;
      mesh.position.set(
        (col - (COLS - 1) / 2) * TILE_PITCH,
        TABLE_Y - TILE_THICKNESS / 2 + lift + Math.sin(pulse * Math.PI) * 0.03,
        NEAR_Z - (row - track.scroll) * TILE_PITCH,
      );
      const s = 1 + Math.sin(pulse * Math.PI) * 0.1;
      mesh.scale.set(s, 1, s);

      // Colour shift: only what is DISPLAYED changes, and never on the row being chosen.
      const shown =
        mods & Mod.Shift
          ? shiftDisplayColor({
              trueColor,
              tileId: e.getValue(Tile, 'tileId')!,
              time,
              isChoosingRow: row === track.target,
              understood: shiftUnderstood,
            })
          : trueColor;

      const hidden = kind === TileKind.Mystery && !e.getValue(Tile, 'revealed');
      const set = mods & Mod.Mirror ? mirrorMaterials : tileMaterials;
      mesh.material = hidden ? mysteryMaterials[state] : set[shown][state];

      const markers = mesh.userData.markers as TileMarkers | undefined;
      if (markers) {
        markers.gem.visible = kind === TileKind.Reward;
        markers.gem.rotation.y = time * 1.5;
        const mirrored = (mods & Mod.Mirror) !== 0;
        markers.reflection.visible = mirrored;
        if (mirrored) markers.reflection.material = reflectionMaterials[e.getValue(Tile, 'decoy')!];
        markers.ring.visible = (mods & Mod.Memory) !== 0;
      }

      if (state === TileState.Highlighted) targeted = mesh;
    }

    this.outline.visible = targeted !== null;
    if (targeted) {
      this.outline.position.copy(targeted.position);
      this.outline.position.y -= 0.008;
    }

    // Rule switch clue: the whole space briefly tints and clears, then settles.
    const fog = this.scene.fog;
    if (fog instanceof FogExp2) {
      const left = ui.switchFlashUntil - time;
      const k = left > 0 ? Math.min(1, left / 1.5) : 0;
      fog.color.copy(FOG_BASE).lerp(FOG_FLASH, k);
      fog.density = 0.28 - 0.12 * k;
    }
  }
}

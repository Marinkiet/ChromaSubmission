import { createSystem } from '@iwsdk/core';
import { chunks, ui, worldFlags } from './game/instance.js';
import { COLS, ROWS } from './game/palette.js';
import { track } from './game/track.js';
import { readHeapBytes, toMB } from './game/world/memory.js';
import { bindTileToRow } from './tile-data.js';
import { Tile } from './tile-component.js';

/**
 * Advances the virtual forward movement, keeps the chunk window around the
 * player, and recycles pooled tiles that fall behind to the far end.
 */
export class TrackSystem extends createSystem({
  tiles: { required: [Tile] },
}) {
  private statTimer = 0;

  init(): void {
    // Dev movement test: W / ArrowUp / Space moves forward one row.
    const onKey = (e: KeyboardEvent) => {
      if (ui.inputMode !== 'dev-mouse') return;
      if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'Space') {
        track.advance();
      }
    };
    window.addEventListener('keydown', onKey);
    this.cleanupFuncs.push(() => window.removeEventListener('keydown', onKey));
    console.info(`[CHROMA] world seed ${chunks.seed} (add ?seed=${chunks.seed} to replay)`);
  }

  private resetWorld(): void {
    chunks.reset();
    track.scroll = 0;
    track.target = 0;
    chunks.update(0);
    for (const e of this.queries.tiles.entities) {
      const id = e.getValue(Tile, 'tileId')!;
      bindTileToRow(e, Math.floor(id / COLS));
    }
  }

  update(delta: number): void {
    if (worldFlags.resetRequested) {
      worldFlags.resetRequested = false;
      this.resetWorld();
    }

    track.update(delta);
    // Cheap: does real work only when the player enters a new chunk.
    // Centred on the visible scroll position (not the target) so the pool always
    // finds its rows, even if the target runs ahead of the animation.
    chunks.update(Math.floor(track.scroll));

    const limit = track.scroll - 0.5;
    for (const entity of this.queries.tiles.entities) {
      const row = entity.getValue(Tile, 'row')!;
      if (row < limit) bindTileToRow(entity, row + ROWS);
    }

    if (import.meta.env.DEV) {
      this.statTimer += delta;
      if (this.statTimer > 20) {
        this.statTimer = 0;
        const s = chunks.stats;
        console.info(
          `[CHROMA] row ${track.target} chunks live=${chunks.liveChunks} created=${s.created} removed=${s.removed} heap=${toMB(readHeapBytes())}`,
        );
      }
    }
  }
}

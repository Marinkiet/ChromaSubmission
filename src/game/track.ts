/**
 * Virtual forward progression. The player never moves: the tile field scrolls
 * toward them, which avoids head motion and keeps seated play comfortable.
 */
export class TrackState {
  /** Current (smoothed) position, in rows. */
  scroll = 0;
  /** Where we are heading, in rows. */
  target = 0;

  advance(rows = 1): void {
    this.target += rows;
  }

  update(delta: number): void {
    const k = 1 - Math.exp(-5 * delta);
    this.scroll += (this.target - this.scroll) * k;
  }
}

export const track = new TrackState();

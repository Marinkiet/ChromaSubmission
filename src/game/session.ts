import { DiscoveryTracker } from './discovery.js';
import { validateSelection } from './rules.js';
import type { ColorId, RuleConfig, SelectionResult } from './rules.js';

export const Phase = {
  Ready: 'READY',
  Selecting: 'SELECTING',
  Success: 'SUCCESS',
  Failure: 'FAILURE',
  Paused: 'PAUSED',
  GameOver: 'GAME_OVER',
} as const;
export type Phase = (typeof Phase)[keyof typeof Phase];

export type SelectOutcome =
  | { accepted: true; result: SelectionResult; firstDiscovery: boolean }
  | { accepted: false; reason: 'not-selecting' | 'invalid-colour' };

/**
 * One run of the game. Pure state machine:
 *   READY -start-> SELECTING -select-> SUCCESS | FAILURE -completeFeedback->
 *   SELECTING | GAME_OVER.  SELECTING <-> PAUSED.
 * Selections made in any phase other than SELECTING are ignored.
 */
export class GameSession {
  phase: Phase = Phase.Ready;
  sequence: ColorId[] = [];
  score = 0;
  streak = 0;
  bestStreak = 0;
  lives: number;
  lastResult: SelectionResult | null = null;
  readonly discovery = new DiscoveryTracker();

  constructor(public config: RuleConfig) {
    this.lives = config.startingLives;
  }

  /** The previous selection, or null at the start of a sequence. */
  get previous(): ColorId | null {
    return this.sequence.length ? this.sequence[this.sequence.length - 1] : null;
  }

  start(): boolean {
    if (this.phase !== Phase.Ready) return false;
    this.phase = Phase.Selecting;
    return true;
  }

  /**
   * `previous` overrides which colour the pick is judged against. Normal tiles
   * leave it undefined; deception mechanics (memory tiles) may set it.
   */
  select(
    color: ColorId,
    opts: { reward?: boolean; previous?: ColorId | null } = {},
  ): SelectOutcome {
    if (this.phase !== Phase.Selecting) return { accepted: false, reason: 'not-selecting' };
    if (!Number.isInteger(color) || color < 0 || color > 4) {
      return { accepted: false, reason: 'invalid-colour' };
    }

    const result = validateSelection(
      opts.previous !== undefined ? opts.previous : this.previous,
      color,
      { sequence: this.sequence },
      this.config,
    );
    this.lastResult = result;
    const firstDiscovery = this.discovery.record(result.ruleId);

    if (result.valid) {
      if (result.reset) this.sequence = [];
      else this.sequence.push(color);
      const reward = opts.reward ? (this.config.points.reward ?? 50) : 0;
      this.score += this.config.points.valid + result.bonusPoints + reward;
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.phase = Phase.Success;
    } else {
      // The rejected tile never joins the sequence: the player retries from the same spot.
      this.streak = 0;
      this.lives--;
      this.phase = Phase.Failure;
    }
    return { accepted: true, result, firstDiscovery };
  }

  /** Call when the feedback animation has finished. */
  completeFeedback(): boolean {
    if (this.phase === Phase.Success) {
      this.phase = Phase.Selecting;
      return true;
    }
    if (this.phase === Phase.Failure) {
      this.phase = this.lives <= 0 ? Phase.GameOver : Phase.Selecting;
      return true;
    }
    return false;
  }

  pause(): boolean {
    if (this.phase !== Phase.Selecting) return false;
    this.phase = Phase.Paused;
    return true;
  }

  resume(): boolean {
    if (this.phase !== Phase.Paused) return false;
    this.phase = Phase.Selecting;
    return true;
  }

  /** Swap the active rules. Clears the sequence so old links cannot leak across. */
  setConfig(config: RuleConfig): void {
    this.config = config;
    this.sequence = [];
    this.lastResult = null;
  }

  restart(): void {
    this.phase = Phase.Ready;
    this.sequence = [];
    this.score = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.lives = this.config.startingLives;
    this.lastResult = null;
    this.discovery.clear();
  }
}

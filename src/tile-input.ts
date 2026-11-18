import { Hovered, Pressed, createSystem } from '@iwsdk/core';
import { playBad, playBonus, playGood, playHover, playSwitch } from './audio.js';
import { introText, pendingIntros } from './game/deception/intro.js';
import { resolveSelection } from './game/deception/resolve.js';
import { chunks, inputAllowed, introduced, session, ui } from './game/instance.js';
import { colorName } from './game/rules.js';
import { TileKind } from './game/world/types.js';
import { Phase } from './game/session.js';
import { TileState } from './game/palette.js';
import { track } from './game/track.js';
import { Tile } from './tile-component.js';

const FEEDBACK_SECONDS = 0.7; // how long the result is shown before the next pick
const LOCKOUT_SECONDS = 0.5; // minimum gap between selections (duplicate guard)

/** Only the row right in front of the player can be chosen: no long reaches. */
export function isSelectableRow(row: number): boolean {
  return row === track.target;
}

/**
 * Turns hand-ray targeting (Hovered) and pinch (Pressed) into rule-engine
 * selections. IWSDK emits Hovered/Pressed from the hand pointer; a mouse emits
 * the same tags, so InputModeSystem decides whether they are trusted.
 */
export class TileInputSystem extends createSystem({
  tiles: { required: [Tile] },
  hovered: { required: [Tile, Hovered] },
  pressed: { required: [Tile, Pressed] },
}) {
  private now = 0;
  private worldTime = 0;
  private lockUntil = 0;
  private feedbackLeft = 0;

  init(): void {
    this.queries.hovered.subscribe('qualify', (e) => {
      e.setValue(Tile, 'hovered', true);
      if (inputAllowed() && isSelectableRow(e.getValue(Tile, 'row')!)) playHover();
    });
    this.queries.hovered.subscribe('disqualify', (e) => e.setValue(Tile, 'hovered', false));
    this.queries.pressed.subscribe('qualify', (e) => this.onPinch(e));
  }

  private onPinch(e: Parameters<Parameters<typeof this.queries.pressed.subscribe>[1]>[0]): void {
    if (ui.inputMode === 'controllers-blocked') {
      ui.message = 'CHROMA is hands-only. Put the controllers down.';
      ui.tone = 'bad';
      return;
    }
    if (!inputAllowed()) return;
    if (this.now < this.lockUntil) return; // duplicate pinch guard
    if (!isSelectableRow(e.getValue(Tile, 'row')!)) return;

    const color = e.getValue(Tile, 'colorIndex')!;
    const kind = e.getValue(Tile, 'kind')!;
    // Memory tiles are judged against an earlier pick. The rule engine itself is unchanged.
    const memory = resolveSelection({ mods: e.getValue(Tile, 'mods')! }, session.sequence);
    const out = session.select(color, { reward: kind === TileKind.Reward, previous: memory.previous });
    if (!out.accepted) return; // paused, game over, or still showing feedback

    this.lockUntil = this.now + LOCKOUT_SECONDS;
    this.feedbackLeft = FEEDBACK_SECONDS;
    e.setValue(Tile, 'pulse', 1);
    e.setValue(Tile, 'revealed', true);

    const r = out.result;
    const prefix = kind === TileKind.Mystery ? `Mystery: ${colorName(color)}. ` : '';
    ui.message = prefix + r.explanation + (memory.note ? ` ${memory.note}` : '');
    if (r.valid) {
      track.advance(); // seated forward progression
      ui.tone = r.bonus || kind === TileKind.Reward ? 'bonus' : 'good';
      (r.bonus || kind === TileKind.Reward ? playBonus : playGood)();
      this.enterRow(track.target);
    } else {
      ui.tone = 'bad';
      playBad();
    }
  }

  /** Runs when a new row becomes the one being chosen from. */
  private enterRow(row: number): void {
    // A new base rule set clears the sequence. A rule switch changes one rule and keeps it.
    const next = chunks.rowConfig(row);
    if (next !== session.config) {
      if (chunks.clearsSequenceAt(row)) {
        session.setConfig(next);
        ui.message += ' The rules have shifted.';
      } else {
        session.config = next; // same chain, one rule differs
        if (chunks.ruleSwitchAt(row)) {
          ui.switchFlashUntil = this.worldTime + 1.5; // visual clue: the space flashes
          ui.message += ' The air shivers. A rule has changed.';
          introduced.add('ruleSwitch');
          playSwitch();
        }
      }
    }

    // Introduce each deception mechanic the first time it is your turn to choose from it.
    const spec = chunks.tryGetRow(row);
    if (spec) {
      const fresh = pendingIntros(spec, introduced);
      if (fresh.length) {
        ui.clue = `New: ${introText(fresh[0])}`;
        for (const id of fresh) introduced.add(id);
      }
    }
  }

  update(delta: number, time: number): void {
    this.now += delta;
    this.worldTime = time;

    if (this.feedbackLeft > 0) {
      this.feedbackLeft -= delta;
      if (this.feedbackLeft <= 0) session.completeFeedback();
    }
    if (session.phase === Phase.GameOver && ui.tone !== 'bad') ui.tone = 'bad';

    const canTarget = inputAllowed() && session.phase === Phase.Selecting;
    for (const e of this.queries.tiles.entities) {
      const pulse = Math.max(0, e.getValue(Tile, 'pulse')! - delta * 3);
      e.setValue(Tile, 'pulse', pulse);
      const target =
        canTarget && e.getValue(Tile, 'hovered') && isSelectableRow(e.getValue(Tile, 'row')!);
      e.setValue(
        Tile,
        'state',
        pulse > 0 ? TileState.Selected : target ? TileState.Highlighted : TileState.Idle,
      );
    }
  }
}

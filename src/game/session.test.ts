import { describe, expect, it } from 'vitest';
import { TUTORIAL_CONFIG } from './configs.js';
import { DiscoveryTracker } from './discovery.js';
import { TileColor as C } from './palette.js';
import { GameSession, Phase } from './session.js';

function playing(): GameSession {
  const s = new GameSession(TUTORIAL_CONFIG);
  s.start();
  return s;
}
/** Select and finish feedback. */
function pick(s: GameSession, c: number) {
  const out = s.select(c);
  s.completeFeedback();
  return out;
}

describe('phases', () => {
  it('starts READY and ignores selections until started', () => {
    const s = new GameSession(TUTORIAL_CONFIG);
    expect(s.phase).toBe(Phase.Ready);
    expect(s.select(C.Red)).toEqual({ accepted: false, reason: 'not-selecting' });
    expect(s.sequence).toEqual([]);
    expect(s.start()).toBe(true);
    expect(s.phase).toBe(Phase.Selecting);
    expect(s.start()).toBe(false);
  });

  it('valid selection -> SUCCESS -> SELECTING', () => {
    const s = playing();
    s.select(C.Red);
    expect(s.phase).toBe(Phase.Success);
    expect(s.completeFeedback()).toBe(true);
    expect(s.phase).toBe(Phase.Selecting);
  });

  it('invalid selection -> FAILURE -> SELECTING', () => {
    const s = playing();
    pick(s, C.Yellow);
    s.select(C.Red);
    expect(s.phase).toBe(Phase.Failure);
    s.completeFeedback();
    expect(s.phase).toBe(Phase.Selecting);
  });

  it('blocks selections while feedback is processing', () => {
    const s = playing();
    s.select(C.Red);
    const score = s.score;
    expect(s.select(C.Blue)).toEqual({ accepted: false, reason: 'not-selecting' });
    expect(s.score).toBe(score);
    expect(s.sequence).toEqual([C.Red]);
  });

  it('pause / resume only from the right phases and blocks selection', () => {
    const s = playing();
    expect(s.pause()).toBe(true);
    expect(s.phase).toBe(Phase.Paused);
    expect(s.select(C.Red).accepted).toBe(false);
    expect(s.pause()).toBe(false);
    expect(s.resume()).toBe(true);
    expect(s.resume()).toBe(false);
    s.select(C.Red);
    expect(s.pause()).toBe(false); // cannot pause mid-feedback
  });

  it('losing all lives ends the game and blocks input', () => {
    const s = playing();
    pick(s, C.Yellow);
    for (let i = 0; i < 3; i++) {
      s.select(C.Red);
      s.completeFeedback();
    }
    expect(s.lives).toBe(0);
    expect(s.phase).toBe(Phase.GameOver);
    expect(s.select(C.Blue).accepted).toBe(false);
    s.restart();
    expect(s.phase).toBe(Phase.Ready);
    expect(s.lives).toBe(3);
  });

  it('rejects colour ids that do not exist', () => {
    expect(playing().select(7)).toEqual({ accepted: false, reason: 'invalid-colour' });
  });
});

describe('sequence, score and streak', () => {
  it('builds a sequence on valid picks and tracks previous', () => {
    const s = playing();
    expect(s.previous).toBeNull();
    pick(s, C.Red);
    pick(s, C.Blue);
    pick(s, C.Yellow);
    expect(s.sequence).toEqual([C.Red, C.Blue, C.Yellow]);
    expect(s.previous).toBe(C.Yellow);
    expect(s.score).toBe(30);
    expect(s.streak).toBe(3);
  });

  it('a failure keeps the sequence, resets the streak, and costs a life', () => {
    const s = playing();
    pick(s, C.Blue);
    pick(s, C.Yellow);
    pick(s, C.Red); // Yellow -> Red invalid
    expect(s.sequence).toEqual([C.Blue, C.Yellow]);
    expect(s.previous).toBe(C.Yellow);
    expect(s.streak).toBe(0);
    expect(s.bestStreak).toBe(2);
    expect(s.lives).toBe(2);
  });

  it('Green resets the sequence and the next pick is treated as a fresh start', () => {
    const s = playing();
    pick(s, C.Red);
    pick(s, C.Blue);
    pick(s, C.Green);
    expect(s.sequence).toEqual([]);
    expect(s.previous).toBeNull();
    const out = pick(s, C.Yellow); // would be invalid after Blue? no: start rule applies
    expect(out.accepted && out.result.ruleId).toBe('start');
    expect(s.streak).toBe(4); // reset does not break the streak
  });

  it('bonus adds extra points', () => {
    const s = playing();
    pick(s, C.Purple);
    const out = pick(s, C.Blue);
    expect(out.accepted && out.result.bonus).toBe(true);
    expect(s.score).toBe(10 + 10 + 25);
  });
});

describe('rule discovery', () => {
  it('records first discovery and counts repeats', () => {
    const s = playing();
    const a = pick(s, C.Red);
    expect(a.accepted && a.firstDiscovery).toBe(true); // 'start'
    const b = pick(s, C.Blue);
    expect(b.accepted && b.firstDiscovery).toBe(true); // 'red-blue'
    pick(s, C.Green);
    pick(s, C.Red);
    const c = pick(s, C.Blue);
    expect(c.accepted && c.firstDiscovery).toBe(false);
    expect(s.discovery.count('red-blue')).toBe(2);
    expect(s.discovery.has('green-reset')).toBe(true);
  });

  it('lists rules still hidden', () => {
    const s = playing();
    pick(s, C.Red);
    pick(s, C.Blue);
    expect(s.discovery.undiscovered(TUTORIAL_CONFIG)).toEqual([
      'blue-yellow',
      'yellow-red',
      'green-reset',
      'purple-blue',
    ]);
  });

  it('tracker works standalone', () => {
    const d = new DiscoveryTracker();
    expect(d.record('x')).toBe(true);
    expect(d.record('x')).toBe(false);
    d.clear();
    expect(d.has('x')).toBe(false);
  });
});

describe('config changes mid-session', () => {
  it('applies the new rules and clears the old sequence', () => {
    const s = playing();
    pick(s, C.Red);
    s.setConfig({ ...TUTORIAL_CONFIG, fallback: 'valid', rules: [] });
    expect(s.sequence).toEqual([]);
    pick(s, C.Red);
    const out = pick(s, C.Red);
    expect(out.accepted && out.result.valid).toBe(true);
  });
});

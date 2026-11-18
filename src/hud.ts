import {
  CanvasTexture,
  CircleGeometry,
  Hovered,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Pressed,
  RayInteractable,
  createSystem,
} from '@iwsdk/core';
import { chunks, inputAllowed, introduced, session, ui, worldFlags } from './game/instance.js';
import { PALETTE } from './game/palette.js';
import { Phase } from './game/session.js';
import { track } from './game/track.js';
import { tierForDistance } from './game/world/difficulty.js';
import { HudButton } from './hud-component.js';

const TONE_COLOR = { info: '#c8d0ff', good: '#5dff9a', bad: '#ff5d7a', bonus: '#ffd95d' } as const;

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

/**
 * Minimal floating HUD plus one big pause / resume / restart button, both
 * usable with a hand pinch. Redraws a texture only when its content changes.
 */
export class HudSystem extends createSystem({
  buttonPressed: { required: [HudButton, Pressed] },
  buttonHovered: { required: [HudButton, Hovered] },
}) {
  private hudCtx!: CanvasRenderingContext2D;
  private hudTex!: CanvasTexture;
  private btnCtx!: CanvasRenderingContext2D;
  private btnTex!: CanvasTexture;
  private btnMat!: MeshBasicMaterial;
  private lastHud = '';
  private lastBtn = '';
  private now = 0;
  private lockUntil = 0;

  init(): void {
    // HUD panel above the far tiles, tilted toward the seated viewer.
    const [hc, hctx] = makeCanvas(1024, 400);
    this.hudCtx = hctx;
    this.hudTex = new CanvasTexture(hc);
    const panel = new Mesh(
      new PlaneGeometry(0.8, 0.3125),
      new MeshBasicMaterial({ map: this.hudTex, transparent: true, depthWrite: false, fog: false }),
    );
    panel.position.set(0, 1.3, -1.1);
    panel.rotation.x = -0.2;
    this.world.createTransformEntity(panel);

    // Pause button, low and close, no long reach needed.
    const [bc, bctx] = makeCanvas(256, 256);
    this.btnCtx = bctx;
    this.btnTex = new CanvasTexture(bc);
    this.btnMat = new MeshBasicMaterial({ map: this.btnTex, transparent: true, fog: false });
    const button = new Mesh(new CircleGeometry(0.06, 32), this.btnMat);
    button.position.set(-0.55, 0.95, -0.4);
    button.rotation.x = -0.5;
    this.world
      .createTransformEntity(button)
      .addComponent(HudButton)
      .addComponent(RayInteractable);

    this.queries.buttonPressed.subscribe('qualify', () => this.onButton());
  }

  private onButton(): void {
    if (!inputAllowed() || this.now < this.lockUntil) return;
    this.lockUntil = this.now + 0.6;
    switch (session.phase) {
      case Phase.Selecting:
        session.pause();
        ui.message = 'Paused. Pinch the button to resume.';
        ui.tone = 'info';
        break;
      case Phase.Paused:
        session.resume();
        ui.message = 'Back in. Point and pinch.';
        break;
      case Phase.GameOver:
        session.setConfig(chunks.rowConfig(0));
        session.restart();
        session.start();
        worldFlags.resetRequested = true; // back to row 0 of the same seed
        introduced.clear(); // mechanics are taught again on a new run
        ui.switchFlashUntil = 0;
        ui.message = 'New run. The rules are still hidden.';
        ui.tone = 'info';
        ui.clue = '';
        break;
      default:
        break; // ignore while feedback is playing
    }
  }

  private drawHud(): void {
    const c = this.hudCtx;
    const w = 1024;
    const h = 400;
    c.clearRect(0, 0, w, h);
    c.fillStyle = 'rgba(6,8,20,0.72)';
    c.beginPath();
    c.roundRect(0, 0, w, h, 36);
    c.fill();
    c.textAlign = 'left';

    // Input source label. Dev fallback is deliberately loud.
    const mode = ui.inputMode;
    c.font = 'bold 26px sans-serif';
    c.fillStyle = mode === 'hands' ? '#5dd6ff' : '#ffb347';
    c.fillText(
      mode === 'hands'
        ? 'HAND TRACKING'
        : mode === 'dev-mouse'
          ? 'DEV FALLBACK: MOUSE (not hand tracking)'
          : mode === 'controllers-blocked'
            ? 'HANDS ONLY: put controllers down'
            : 'Enter VR to play with your hands',
      36,
      52,
    );

    c.font = 'bold 64px sans-serif';
    c.fillStyle = '#ffd95d';
    c.fillText(`${session.score}`, 36, 130);
    c.font = '30px sans-serif';
    c.fillStyle = '#c8d0ff';
    c.fillText(`streak ${session.streak}`, 36, 172);
    c.fillStyle = '#ff5d7a';
    c.fillText('\u25CF'.repeat(Math.max(0, session.lives)), 36, 212);
    c.font = '24px sans-serif';
    c.fillStyle = '#7f89c8';
    c.fillText(`distance ${track.target}`, 36, 250);
    c.fillText(tierForDistance(track.target).label, 36, 280, 300);

    // The current chain, always shown plainly: it is what memory tiles look back into.
    const chain = session.sequence.slice(-6);
    chain.forEach((color, i) => {
      c.fillStyle = `#${PALETTE[color].toString(16).padStart(6, '0')}`;
      c.beginPath();
      c.arc(46 + i * 30, 336, 11, 0, Math.PI * 2);
      c.fill();
    });
    if (chain.length === 0) c.fillText('chain: empty', 36, 342);

    c.textAlign = 'center';
    const phase = session.phase;
    if (phase === Phase.Paused) {
      c.font = 'bold 72px sans-serif';
      c.fillStyle = '#ffffff';
      c.fillText('PAUSED', 640, 160);
    } else if (phase === Phase.GameOver) {
      c.font = 'bold 64px sans-serif';
      c.fillStyle = '#ff5d7a';
      c.fillText('GAME OVER', 640, 140);
      c.font = '30px sans-serif';
      c.fillStyle = '#c8d0ff';
      c.fillText(`best streak ${session.bestStreak}`, 640, 190);
    } else {
      c.font = 'bold 40px sans-serif';
      c.fillStyle = TONE_COLOR[ui.tone];
      c.fillText(ui.message, 600, 150, 760);
    }

    if (ui.clue) {
      c.font = 'italic 30px sans-serif';
      c.fillStyle = '#a4b0ff';
      c.fillText(`Clue: ${ui.clue}`, 512, 290, 940);
    }
    c.font = '24px sans-serif';
    c.fillStyle = '#7f89c8';
    c.fillText('Open palm: clue    Both palms: ability (soon)', 512, 372);

    // Gesture progress bar
    const p = Math.max(ui.palmProgress, ui.abilityProgress);
    if (p > 0) {
      c.fillStyle = 'rgba(255,255,255,0.15)';
      c.fillRect(262, 330, 500, 10);
      c.fillStyle = ui.abilityProgress > 0 ? '#ffd95d' : '#5dd6ff';
      c.fillRect(262, 330, 500 * p, 10);
    }
    this.hudTex.needsUpdate = true;
  }

  private drawButton(hover: boolean): void {
    const c = this.btnCtx;
    c.clearRect(0, 0, 256, 256);
    c.fillStyle = hover ? '#ffffff' : '#8f9bff';
    c.beginPath();
    c.arc(128, 128, 120, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#0b1020';
    const phase = session.phase;
    if (phase === Phase.Paused) {
      c.beginPath();
      c.moveTo(100, 80);
      c.lineTo(100, 176);
      c.lineTo(180, 128);
      c.fill();
    } else if (phase === Phase.GameOver) {
      c.font = 'bold 140px sans-serif';
      c.textAlign = 'center';
      c.fillText('\u21BB', 128, 175);
    } else {
      c.fillRect(88, 78, 30, 100);
      c.fillRect(138, 78, 30, 100);
    }
    this.btnTex.needsUpdate = true;
  }

  update(delta: number): void {
    this.now += delta;
    const p = Math.round(Math.max(ui.palmProgress, ui.abilityProgress) * 10);
    const hudKey = [
      session.score, session.streak, session.lives, session.phase, session.bestStreak,
      ui.message, ui.tone, ui.clue, ui.inputMode, p, track.target, session.sequence.join(','),
    ].join('|');
    if (hudKey !== this.lastHud) {
      this.lastHud = hudKey;
      this.drawHud();
    }
    const hover = this.queries.buttonHovered.entities.size > 0 && inputAllowed();
    const btnKey = `${session.phase}|${hover}`;
    if (btnKey !== this.lastBtn) {
      this.lastBtn = btnKey;
      this.drawButton(hover);
    }
  }
}

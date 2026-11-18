import { createSystem } from '@iwsdk/core';
import { DEV_FALLBACK, ui } from './game/instance.js';

/**
 * Decides where input is coming from, once per frame, so no other system has
 * to guess. In an XR session only a primary *hand* counts: a mouse or a
 * controller must never be mistaken for hand tracking.
 */
export class InputModeSystem extends createSystem({}) {
  update(): void {
    if (this.renderer.xr.isPresenting) {
      const hands = this.input.xr.isPrimary('hand', 'left') || this.input.xr.isPrimary('hand', 'right');
      ui.inputMode = hands ? 'hands' : 'controllers-blocked';
    } else {
      ui.inputMode = DEV_FALLBACK ? 'dev-mouse' : 'none';
    }
  }
}

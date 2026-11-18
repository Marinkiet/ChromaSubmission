/**
 * Pure hand-gesture logic. It works on joint positions (metres, any common
 * space) so it can be tested without a headset. Joint names are the standard
 * WebXR Hand Input names.
 */

export type Vec3 = readonly [number, number, number];
export type Joints = Partial<Record<string, Vec3>>;

const FINGERS = ['index-finger', 'middle-finger', 'ring-finger', 'pinky-finger'] as const;

function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export interface OpenPalmOptions {
  /** tip-to-wrist distance divided by knuckle-to-wrist distance. Open ~2.0, curled ~1.0. */
  extendRatio: number;
  /** Thumb tip must be at least this far from the index tip, so a pinch never counts. */
  minThumbGap: number;
}
export const DEFAULT_PALM: OpenPalmOptions = { extendRatio: 1.6, minThumbGap: 0.05 };

/** True when all four fingers are extended and the thumb is not pinching. */
export function isOpenPalm(j: Joints, opts: OpenPalmOptions = DEFAULT_PALM): boolean {
  const wrist = j['wrist'];
  const thumb = j['thumb-tip'];
  const indexTip = j['index-finger-tip'];
  if (!wrist || !thumb || !indexTip) return false;

  for (const f of FINGERS) {
    const tip = j[`${f}-tip`];
    const knuckle = j[`${f}-phalanx-proximal`];
    if (!tip || !knuckle) return false;
    const base = dist(knuckle, wrist);
    if (!(base > 0.01)) return false; // also rejects NaN / untracked zeros
    if (!(dist(tip, wrist) / base >= opts.extendRatio)) return false;
  }
  return dist(thumb, indexTip) >= opts.minThumbGap;
}

/**
 * Fires once after `holdSeconds` of continuous activity, then waits for the
 * input to be released AND `cooldownSeconds` to pass. This blocks accidental
 * repeats and rapid repetitive gestures.
 */
export class HoldTimer {
  private held = 0;
  private cooldown = 0;
  private armed = true;

  constructor(
    readonly holdSeconds: number,
    readonly cooldownSeconds: number,
  ) {}

  /** 0..1 progress toward firing, for UI. */
  get progress(): number {
    return this.armed && this.cooldown <= 0 ? Math.min(1, this.held / this.holdSeconds) : 0;
  }

  /** Returns true on the frame the gesture completes. */
  update(delta: number, active: boolean): boolean {
    if (this.cooldown > 0) this.cooldown -= delta;
    if (!active) {
      this.held = 0;
      this.armed = true; // released: may fire again once cooldown ends
      return false;
    }
    if (!this.armed || this.cooldown > 0) return false;
    this.held += delta;
    if (this.held >= this.holdSeconds) {
      this.held = 0;
      this.armed = false;
      this.cooldown = this.cooldownSeconds;
      return true;
    }
    return false;
  }

  reset(): void {
    this.held = 0;
    this.cooldown = 0;
    this.armed = true;
  }
}

/**
 * Both palms open at once, held. Reserved for future abilities. Independent of
 * rendering and of the single-palm clue gesture.
 */
export class TwoHandGesture {
  private timer: HoldTimer;
  constructor(holdSeconds = 0.8, cooldownSeconds = 3) {
    this.timer = new HoldTimer(holdSeconds, cooldownSeconds);
  }
  get progress(): number {
    return this.timer.progress;
  }
  /** Pass null for a hand that is not tracked. Tracking loss resets the hold. */
  update(delta: number, leftOpen: boolean | null, rightOpen: boolean | null): boolean {
    return this.timer.update(delta, leftOpen === true && rightOpen === true);
  }
  reset(): void {
    this.timer.reset();
  }
}

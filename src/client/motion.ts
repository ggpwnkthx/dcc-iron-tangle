export interface MotionFrame {
  readonly dt: number;
  readonly elapsed: number;
}

export type MotionStep = (frame: MotionFrame) => void;

/**
 * Keeps animation timing and lifecycle out of the render loop.
 *
 * A scene object registers one named motion. Removing the object removes the
 * motion by the same id, so animation code does not accumulate special cases.
 */
export class MotionRegistry {
  #elapsed = 0;
  #steps = new Map<string, MotionStep>();

  get elapsed() {
    return this.#elapsed;
  }

  get size() {
    return this.#steps.size;
  }

  register(id: string, step: MotionStep) {
    if (this.#steps.has(id)) throw new TypeError(`Motion ${id} is already registered`);
    this.#steps.set(id, step);
    return () => {
      if (this.#steps.get(id) !== step) return false;
      return this.remove(id);
    };
  }

  remove(id: string) {
    return this.#steps.delete(id);
  }

  update(dt: number) {
    if (!Number.isFinite(dt) || dt < 0) {
      throw new TypeError("Motion delta must be a finite, non-negative number");
    }
    this.#elapsed += dt;
    const frame = { dt, elapsed: this.#elapsed };
    this.#steps.forEach((step) => step(frame));
  }
}

/** Positive modulo, useful for looped motion in either direction. */
export function wrap(value: number, span: number) {
  if (!Number.isFinite(span) || span <= 0) throw new TypeError("Wrap span must be positive");
  return ((value % span) + span) % span;
}

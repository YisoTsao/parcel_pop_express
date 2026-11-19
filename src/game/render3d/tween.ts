/** Minimal frame-driven tween runner. Promises resolve true on finish, false on cancel. */
export type Ease = (t: number) => number;

export const ease = {
  linear: (t: number) => t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t: number) => {
    const c1 = 1.4;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outBounce: (t: number) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

interface Tween {
  elapsed: number;
  delay: number;
  duration: number;
  ease: Ease;
  update: (t: number) => void;
  resolve: (done: boolean) => void;
}

export class Tweener {
  private list: Tween[] = [];

  /** duration/delay in seconds. A zero duration applies the end state on the next frame. */
  to(duration: number, update: (t: number) => void, e: Ease = ease.outCubic, delay = 0): Promise<boolean> {
    return new Promise((resolve) => {
      this.list.push({ elapsed: 0, delay, duration: Math.max(0, duration), ease: e, update, resolve });
    });
  }

  wait(seconds: number): Promise<boolean> {
    return this.to(seconds, () => {}, ease.linear);
  }

  update(dt: number): void {
    if (this.list.length === 0) return;
    const keep: Tween[] = [];
    for (const tw of this.list) {
      tw.elapsed += dt;
      const t = tw.elapsed - tw.delay;
      if (t < 0) {
        keep.push(tw);
        continue;
      }
      const p = tw.duration === 0 ? 1 : Math.min(1, t / tw.duration);
      tw.update(tw.ease(p));
      if (p >= 1) tw.resolve(true);
      else keep.push(tw);
    }
    this.list = keep;
  }

  cancelAll(): void {
    const l = this.list;
    this.list = [];
    for (const tw of l) tw.resolve(false);
  }

  get busy(): boolean {
    return this.list.length > 0;
  }
}

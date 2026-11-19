/**
 * Tiny synthesized SFX (no external assets). Unlocked on first user gesture;
 * any failure is swallowed so audio can never block play (TEST_PLAN U10).
 */
type Sfx = 'shift' | 'pop' | 'combo' | 'land' | 'win' | 'lose' | 'tap';

let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean): void {
  enabled = on;
}

export function unlockAudio(): void {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, when = 0, slideTo?: number): void {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export function playSfx(name: Sfx, level = 1): void {
  if (!enabled || !ctx || ctx.state !== 'running') return;
  try {
    switch (name) {
      case 'tap':
        tone(660, 0.05, 'sine', 0.05);
        break;
      case 'shift':
        tone(300, 0.12, 'triangle', 0.08, 0, 420);
        break;
      case 'pop':
        tone(520 + level * 90, 0.14, 'sine', 0.12, 0, 880 + level * 120);
        break;
      case 'combo':
        [0, 0.06, 0.12].forEach((d, i) => tone(660 + i * 220 + level * 40, 0.12, 'triangle', 0.08, d));
        break;
      case 'land':
        tone(180, 0.08, 'sine', 0.06, 0, 120);
        break;
      case 'win':
        [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.1, i * 0.1));
        break;
      case 'lose':
        [392, 330, 262].forEach((f, i) => tone(f, 0.25, 'sine', 0.08, i * 0.14));
        break;
    }
  } catch {
    /* ignore */
  }
}

/**
 * Every sound effect, synthesized on the spot: layered tones and filtered noise, with a little
 * pitch variation on the ones heard most so a combo doesn't sound like a machine gun.
 */

interface Kit {
  ctx: AudioContext;
  out: AudioNode;
  at: number;
  noise: AudioBuffer;
  wave: (duty: number) => PeriodicWave;
}

type Shape = OscillatorType | number;

/** A pitched sweep with a fast attack and an exponential fall. `shape` number = pulse duty. */
function tone(
  k: Kit,
  shape: Shape,
  from: number,
  to: number,
  dur: number,
  gain: number,
  delay = 0,
): void {
  const { ctx } = k;
  const at = k.at + delay;
  const osc = ctx.createOscillator();
  if (typeof shape === 'number') osc.setPeriodicWave(k.wave(shape));
  else osc.type = shape;
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(k.out);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

/** Filtered noise; the filter sweeps from `f0` to `f1`. */
function hiss(
  k: Kit,
  type: BiquadFilterType,
  f0: number,
  f1: number,
  dur: number,
  gain: number,
  delay = 0,
  q = 1,
): void {
  const { ctx } = k;
  const at = k.at + delay;
  const src = ctx.createBufferSource();
  src.buffer = k.noise;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(f0, at);
  filter.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(filter).connect(g).connect(k.out);
  src.start(at, Math.random() * 0.4);
  src.stop(at + dur + 0.02);
}

/** ±`amount` random pitch factor. */
const vary = (amount: number) => 1 + (Math.random() * 2 - 1) * amount;

const BLIPS = [523, 587, 659];

export const SFX = {
  hit: (k: Kit) => {
    const v = vary(0.08);
    hiss(k, 'bandpass', 1400 * v, 380, 0.08, 0.35, 0, 1.4);
    tone(k, 0.5, 190 * v, 70, 0.07, 0.16);
  },
  hitHeavy: (k: Kit) => {
    const v = vary(0.05);
    hiss(k, 'lowpass', 2600, 240, 0.2, 0.45);
    tone(k, 'sine', 130 * v, 38, 0.22, 0.4);
    tone(k, 0.5, 95 * v, 48, 0.12, 0.14);
  },
  swing: (k: Kit) => {
    hiss(k, 'bandpass', 500 * vary(0.1), 2600, 0.09, 0.12, 0, 2);
  },
  kiShot: (k: Kit) => {
    const v = vary(0.06);
    tone(k, 0.25, 960 * v, 300, 0.13, 0.11);
    tone(k, 'sine', 1900 * v, 950, 0.08, 0.06);
  },
  kiBig: (k: Kit) => {
    tone(k, 'sawtooth', 200, 900, 0.28, 0.12);
    tone(k, 0.25, 400, 1600, 0.22, 0.06, 0.03);
    hiss(k, 'lowpass', 900, 120, 0.4, 0.22);
  },
  hurt: (k: Kit) => {
    tone(k, 0.5, 420, 140, 0.18, 0.2);
    hiss(k, 'bandpass', 900, 300, 0.1, 0.2);
  },
  block: (k: Kit) => {
    tone(k, 'triangle', 1250, 900, 0.06, 0.2);
    tone(k, 0.125, 2600, 2300, 0.05, 0.05);
  },
  levelUp: (k: Kit) => {
    [523, 659, 784, 1046].forEach((f, i) => {
      tone(k, 0.25, f, f, 0.12, 0.12, i * 0.08);
    });
    tone(k, 'triangle', 1568, 2093, 0.4, 0.08, 0.32);
  },
  pickup: (k: Kit) => {
    tone(k, 'triangle', 880, 1760, 0.1, 0.16);
    tone(k, 0.125, 1760, 2637, 0.12, 0.05, 0.05);
  },
  chest: (k: Kit) => {
    tone(k, 0.25, 523, 523, 0.09, 0.12);
    tone(k, 0.25, 784, 784, 0.09, 0.12, 0.08);
    tone(k, 'triangle', 1046, 1568, 0.3, 0.12, 0.16);
  },
  gate: (k: Kit) => {
    hiss(k, 'lowpass', 900, 90, 0.5, 0.4);
    tone(k, 'sawtooth', 90, 34, 0.45, 0.14);
  },
  menuMove: (k: Kit) => {
    tone(k, 0.125, 1320, 1320, 0.03, 0.05);
  },
  menuConfirm: (k: Kit) => {
    tone(k, 0.25, 880, 1320, 0.06, 0.08);
    tone(k, 0.25, 1760, 1760, 0.06, 0.05, 0.05);
  },
  transform: (k: Kit) => {
    tone(k, 'sawtooth', 110, 880, 0.6, 0.12);
    tone(k, 0.5, 220, 1760, 0.6, 0.05);
    hiss(k, 'highpass', 300, 5000, 0.7, 0.14);
    for (const f of [523, 659, 784]) tone(k, 'triangle', f, f, 0.5, 0.06, 0.55);
  },
  save: (k: Kit) => {
    tone(k, 'sine', 660, 660, 0.14, 0.16);
    tone(k, 'sine', 990, 990, 0.24, 0.16, 0.12);
    tone(k, 'triangle', 1320, 1320, 0.3, 0.06, 0.2);
  },
  enemyDown: (k: Kit) => {
    hiss(k, 'lowpass', 1600, 180, 0.28, 0.3);
    tone(k, 0.5, 320 * vary(0.08), 55, 0.24, 0.14);
  },
  takeoff: (k: Kit) => {
    hiss(k, 'bandpass', 300, 2200, 0.32, 0.18, 0, 1.5);
    tone(k, 'sine', 260, 720, 0.24, 0.1);
  },
  land: (k: Kit) => {
    hiss(k, 'lowpass', 900, 120, 0.14, 0.25);
    tone(k, 'triangle', 220, 70, 0.12, 0.16);
  },
  quake: (k: Kit) => {
    hiss(k, 'lowpass', 220, 60, 1.1, 0.5);
    tone(k, 'sawtooth', 52, 36, 0.9, 0.12);
  },
  emote: (k: Kit) => {
    tone(k, 0.25, 880, 1320, 0.08, 0.06);
  },
  kiFull: (k: Kit) => {
    tone(k, 'triangle', 1320, 1760, 0.12, 0.1);
    tone(k, 'sine', 2640, 2640, 0.2, 0.05, 0.08);
  },
  kiFocus: (k: Kit) => {
    tone(k, 'sine', 180 * vary(0.03), 270, 0.08, 0.03);
  },
  blip: (k: Kit) => {
    const f = BLIPS[Math.floor(Math.random() * BLIPS.length)] ?? 587;
    tone(k, 0.25, f, f, 0.03, 0.035);
  },
  roar: (k: Kit) => {
    tone(k, 'sawtooth', 95, 55, 0.9, 0.16);
    tone(k, 0.5, 70, 45, 0.8, 0.08);
    hiss(k, 'lowpass', 700, 150, 0.9, 0.3);
  },
  warp: (k: Kit) => {
    tone(k, 'sine', 300, 1200, 0.35, 0.1);
    tone(k, 'triangle', 600, 2400, 0.3, 0.05, 0.05);
  },
  buy: (k: Kit) => {
    tone(k, 0.5, 988, 988, 0.06, 0.1);
    tone(k, 0.5, 1319, 1319, 0.2, 0.1, 0.06);
  },
  denied: (k: Kit) => {
    tone(k, 0.5, 220, 220, 0.08, 0.1);
    tone(k, 0.5, 150, 150, 0.14, 0.1, 0.09);
  },
  explode: (k: Kit) => {
    hiss(k, 'lowpass', 3200, 90, 0.8, 0.5);
    tone(k, 'sine', 90, 28, 0.7, 0.4);
  },
  ultimate: (k: Kit) => {
    tone(k, 'sawtooth', 70, 520, 1.3, 0.1);
    hiss(k, 'bandpass', 200, 3000, 1.3, 0.14, 0, 3);
  },
  heartbeat: (k: Kit) => {
    tone(k, 'sine', 70, 40, 0.16, 0.45);
    tone(k, 'sine', 60, 35, 0.2, 0.35, 0.2);
  },
} as const satisfies Record<string, (k: Kit) => void>;

export type SfxId = keyof typeof SFX;
export type { Kit };

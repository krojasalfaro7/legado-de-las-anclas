import { compile, type Song, type Wave } from './song';
import { freq } from './theory';
import { TRACKS } from './tracks';

/** How far ahead notes are scheduled, and how often the scheduler wakes (the usual WebAudio trick). */
const LOOKAHEAD_S = 0.15;
const TICK_MS = 30;
const FADE_OUT_S = 0.8;
const FADE_IN_S = 0.4;

const songs = new Map<string, Song>();
function song(id: string): Song | null {
  const def = TRACKS[id];
  if (!def) return null;
  let s = songs.get(id);
  if (!s) {
    s = compile(def);
    songs.set(id, s);
  }
  return s;
}

/** Fourier series of a pulse wave with this duty cycle (the GBA's 12.5/25/50 % squares). */
function pulseWave(ctx: AudioContext, duty: number): PeriodicWave {
  const n = 40;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let i = 1; i < n; i++) real[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
  return ctx.createPeriodicWave(real, imag);
}

/** One playing track: its own gain (for crossfades), echo and filter, and a scheduler. */
class Playback {
  readonly out: GainNode;
  private readonly bus: AudioNode;
  private readonly echoIn: GainNode | null;
  private step = 0;
  private nextAt: number;
  private timer: number;
  private readonly stepS: number;

  constructor(
    private readonly ctx: AudioContext,
    private readonly song: Song,
    dest: AudioNode,
    private readonly waves: Record<Wave, PeriodicWave | OscillatorType>,
    private readonly noise: AudioBuffer,
    private readonly onEnd: () => void,
  ) {
    const def = song.def;
    this.stepS = 60 / def.bpm / 2;
    this.out = ctx.createGain();
    this.out.gain.setValueAtTime(0, ctx.currentTime);
    this.out.gain.linearRampToValueAtTime(1, ctx.currentTime + FADE_IN_S);
    this.out.connect(dest);
    let bus: AudioNode = this.out;
    if (def.cutoff) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = def.cutoff;
      lp.connect(this.out);
      bus = lp;
    }
    this.bus = bus;
    if (def.echo) {
      // A dotted-eighth echo, darkened on each repeat.
      const delay = ctx.createDelay(2);
      delay.delayTime.value = this.stepS * 3;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.35;
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 2400;
      this.echoIn = ctx.createGain();
      this.echoIn.gain.value = def.echo;
      this.echoIn.connect(delay);
      delay.connect(tone).connect(feedback).connect(delay);
      tone.connect(bus);
    } else {
      this.echoIn = null;
    }
    this.nextAt = ctx.currentTime + 0.05;
    this.timer = window.setInterval(() => this.schedule(), TICK_MS);
    this.schedule();
  }

  private schedule(): void {
    const until = this.ctx.currentTime + LOOKAHEAD_S;
    // A throttled background tab can fall behind: skip ahead rather than play a burst.
    if (this.nextAt < this.ctx.currentTime - 0.1) this.nextAt = this.ctx.currentTime + 0.02;
    while (this.nextAt < until) {
      if (this.step >= this.song.length) {
        if (this.song.def.once) {
          this.stop(0.5);
          window.setTimeout(this.onEnd, (this.nextAt - this.ctx.currentTime) * 1000 + 600);
          return;
        }
        this.step = 0;
      }
      this.playStep(this.step, this.nextAt);
      this.step++;
      this.nextAt += this.stepS;
    }
  }

  private playStep(step: number, at: number): void {
    for (const v of this.song.voices) {
      for (const e of v.events) {
        if (e.step !== step) continue;
        this.note(v.wave, v.vol, freq(e.midi), at, e.len * this.stepS, v.lead);
      }
    }
    const drumVol = this.song.def.drumVol ?? 1;
    for (const d of this.song.drums) if (d.step === step) this.drum(d.hit, at, drumVol);
  }

  private note(wave: Wave, vol: number, hz: number, at: number, dur: number, lead: boolean): void {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const shape = this.waves[wave];
    if (typeof shape === 'string') osc.type = shape as OscillatorType;
    else osc.setPeriodicWave(shape);
    osc.frequency.setValueAtTime(hz, at);
    const g = ctx.createGain();
    const attack = wave === 'triangle' ? 0.005 : 0.01;
    const release = lead ? 0.08 : 0.05;
    const end = at + Math.max(0.05, dur - 0.02);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + attack);
    // Decay to a sustain, like a handheld's volume envelope.
    g.gain.setTargetAtTime(vol * (lead ? 0.7 : 0.55), at + attack, 0.12);
    g.gain.setTargetAtTime(0, end, release / 3);
    osc.connect(g).connect(this.bus);
    if (lead) {
      if (this.echoIn) g.connect(this.echoIn);
      if (dur > 0.3) {
        // Vibrato that arrives late on long notes.
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 5.5;
        const depth = ctx.createGain();
        depth.gain.setValueAtTime(0, at);
        depth.gain.linearRampToValueAtTime(hz * 0.006, at + Math.min(0.4, dur));
        lfo.connect(depth).connect(osc.frequency);
        lfo.start(at);
        lfo.stop(end + release);
      }
    }
    osc.start(at);
    osc.stop(end + release * 2);
  }

  private drum(hit: string, at: number, vol: number): void {
    const ctx = this.ctx;
    if (hit === 'k' || hit === 't') {
      // Kick: a sine that drops fast. Tom: the same, higher and longer.
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const [from, to, len] = hit === 'k' ? [140, 42, 0.16] : [220, 110, 0.2];
      osc.frequency.setValueAtTime(from, at);
      osc.frequency.exponentialRampToValueAtTime(to, at + len);
      g.gain.setValueAtTime(0.32 * vol, at);
      g.gain.exponentialRampToValueAtTime(0.001, at + len);
      osc.connect(g).connect(this.bus);
      osc.start(at);
      osc.stop(at + len + 0.02);
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();
    const [type, hz, level, len]: [BiquadFilterType, number, number, number] =
      hit === 's'
        ? ['bandpass', 1800, 0.22, 0.14]
        : hit === 'o'
          ? ['highpass', 7000, 0.07, 0.22]
          : ['highpass', 8000, 0.06, 0.04];
    filter.type = type;
    filter.frequency.value = hz;
    g.gain.setValueAtTime(level * vol, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + len);
    src.connect(filter).connect(g).connect(this.bus);
    src.start(at, Math.random() * 0.5);
    src.stop(at + len + 0.02);
  }

  stop(fade = FADE_OUT_S): void {
    window.clearInterval(this.timer);
    const now = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(this.out.gain.value, now);
    this.out.gain.linearRampToValueAtTime(0, now + fade);
    window.setTimeout(() => this.out.disconnect(), (fade + 0.3) * 1000 + LOOKAHEAD_S * 1000);
  }
}

/**
 * The soundtrack player: one track at a time, crossfading on change. Stingers (`once`) play over
 * nothing and then hand back to the track that was playing before them.
 */
export class MusicPlayer {
  private current: { id: string; playback: Playback } | null = null;
  private resumeId: string | null = null;
  private waves: Record<Wave, PeriodicWave | OscillatorType> | null = null;
  private noise: AudioBuffer | null = null;

  constructor(
    private readonly ctx: () => AudioContext | null,
    private readonly dest: () => AudioNode | null,
  ) {}

  get playing(): string | null {
    return this.current?.id ?? null;
  }

  play(id: string | null): void {
    if (id === this.current?.id) return;
    const ctx = this.ctx();
    const dest = this.dest();
    this.current?.playback.stop();
    this.current = null;
    const s = id ? song(id) : null;
    if (!id || !s || !ctx || !dest) {
      // Remember what should be playing once audio is allowed to start.
      this.resumeId = id;
      return;
    }
    if (s.def.once) this.resumeId = this.resumeId ?? null;
    else this.resumeId = id;
    this.ensureSources(ctx);
    const playback = new Playback(
      ctx,
      s,
      dest,
      this.waves as Record<Wave, PeriodicWave | OscillatorType>,
      this.noise as AudioBuffer,
      () => {
        if (this.current?.playback !== playback) return;
        this.current = null;
        if (this.resumeId) this.play(this.resumeId);
      },
    );
    this.current = { id, playback };
  }

  /**
   * A stinger in place of the current track. Afterwards `then` plays (`null`: silence); by
   * default the track that was playing comes back.
   */
  sting(id: string, then?: string | null): void {
    const back =
      then !== undefined
        ? then
        : this.current && !TRACKS[this.current.id]?.once
          ? this.current.id
          : this.resumeId;
    this.play(id);
    this.resumeId = back;
  }

  /** Audio just became allowed: start whatever was asked for meanwhile. */
  wake(): void {
    if (!this.current && this.resumeId) {
      const id = this.resumeId;
      this.resumeId = null;
      this.play(id);
    }
  }

  private ensureSources(ctx: AudioContext): void {
    if (!this.waves) {
      this.waves = {
        pulse12: pulseWave(ctx, 0.125),
        pulse25: pulseWave(ctx, 0.25),
        pulse50: pulseWave(ctx, 0.5),
        triangle: 'triangle' as OscillatorType,
        saw: 'sawtooth' as OscillatorType,
      };
    }
    if (!this.noise) {
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noise = buf;
    }
  }
}

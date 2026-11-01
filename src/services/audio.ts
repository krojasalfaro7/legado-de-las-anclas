import type Phaser from 'phaser';
import { loadOptions } from './storage';

/**
 * Sound hooks used across the game. If a matching file was loaded into Phaser's
 * audio cache (key `sfx-<id>`, see public/assets/audio/README) it is played;
 * otherwise a tiny WebAudio synth stands in so the game is never silent.
 */
export type SfxId =
  | 'hit'
  | 'hitHeavy'
  | 'kiShot'
  | 'kiBig'
  | 'hurt'
  | 'block'
  | 'levelUp'
  | 'pickup'
  | 'chest'
  | 'gate'
  | 'menuMove'
  | 'menuConfirm'
  | 'transform'
  | 'save'
  | 'enemyDown'
  | 'takeoff'
  | 'land'
  | 'quake'
  | 'emote'
  | 'kiFull'
  | 'kiFocus';

interface Tone {
  type: OscillatorType;
  from: number;
  to: number;
  ms: number;
  gain: number;
  noise?: boolean;
}

const SYNTH: Record<SfxId, Tone[]> = {
  hit: [{ type: 'square', from: 220, to: 90, ms: 70, gain: 0.25, noise: true }],
  hitHeavy: [{ type: 'square', from: 160, to: 50, ms: 140, gain: 0.35, noise: true }],
  kiShot: [{ type: 'sawtooth', from: 880, to: 320, ms: 120, gain: 0.12 }],
  kiBig: [
    { type: 'sawtooth', from: 300, to: 900, ms: 220, gain: 0.15 },
    { type: 'square', from: 120, to: 60, ms: 260, gain: 0.12, noise: true },
  ],
  hurt: [{ type: 'square', from: 300, to: 120, ms: 160, gain: 0.25 }],
  block: [{ type: 'triangle', from: 900, to: 700, ms: 60, gain: 0.2 }],
  levelUp: [
    { type: 'square', from: 523, to: 523, ms: 90, gain: 0.15 },
    { type: 'square', from: 659, to: 659, ms: 90, gain: 0.15 },
    { type: 'square', from: 784, to: 1046, ms: 200, gain: 0.15 },
  ],
  pickup: [{ type: 'triangle', from: 880, to: 1760, ms: 110, gain: 0.18 }],
  chest: [
    { type: 'triangle', from: 440, to: 440, ms: 80, gain: 0.18 },
    { type: 'triangle', from: 880, to: 1320, ms: 160, gain: 0.18 },
  ],
  gate: [{ type: 'sawtooth', from: 200, to: 40, ms: 400, gain: 0.3, noise: true }],
  menuMove: [{ type: 'square', from: 660, to: 660, ms: 30, gain: 0.08 }],
  menuConfirm: [{ type: 'square', from: 880, to: 1175, ms: 70, gain: 0.1 }],
  transform: [{ type: 'sawtooth', from: 110, to: 880, ms: 500, gain: 0.18 }],
  quake: [
    { type: 'sawtooth', from: 55, to: 38, ms: 900, gain: 0.22 },
    { type: 'square', from: 70, to: 45, ms: 700, gain: 0.08 },
  ],
  emote: [{ type: 'square', from: 880, to: 1320, ms: 90, gain: 0.07 }],
  kiFull: [{ type: 'triangle', from: 1320, to: 1760, ms: 120, gain: 0.12 }],
  // Played in quick succession while focusing: a soft rising hum.
  kiFocus: [{ type: 'sine', from: 180, to: 260, ms: 70, gain: 0.03 }],
  save: [
    { type: 'sine', from: 660, to: 660, ms: 120, gain: 0.18 },
    { type: 'sine', from: 990, to: 990, ms: 200, gain: 0.18 },
  ],
  enemyDown: [{ type: 'square', from: 400, to: 60, ms: 220, gain: 0.2, noise: true }],
  takeoff: [{ type: 'sine', from: 260, to: 720, ms: 220, gain: 0.16, noise: true }],
  land: [{ type: 'triangle', from: 220, to: 70, ms: 120, gain: 0.2, noise: true }],
};

/** For data that names sounds by string (cutscene scripts). */
export function isSfx(id: string): id is SfxId {
  return id in SYNTH;
}

class AudioService {
  private ctx: AudioContext | null = null;
  private game: Phaser.Game | null = null;
  volume = loadOptions().volume;

  attach(game: Phaser.Game, target: Window): void {
    this.game = game;
    // Browsers only allow audio after a user gesture.
    const unlock = (): void => {
      void this.context()?.resume();
    };
    target.addEventListener('keydown', unlock);
    target.addEventListener('pointerdown', unlock);
  }

  private context(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      this.ctx = new AudioContext();
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  play(id: SfxId): void {
    if (this.volume <= 0) return;
    const key = `sfx-${id}`;
    const sound = this.game?.sound;
    if (sound && this.game?.cache.audio.exists(key)) {
      sound.play(key, { volume: this.volume });
      return;
    }
    this.synth(SYNTH[id]);
  }

  private music: Phaser.Sound.BaseSound | null = null;
  private musicKey: string | null = null;

  /** Plays a looping track if it was loaded; no-op otherwise (music hooks for later). */
  playMusic(key: string | undefined): void {
    const cacheKey = key ? `music-${key}` : null;
    if (cacheKey === this.musicKey) return;
    this.music?.stop();
    this.music = null;
    this.musicKey = cacheKey;
    if (!cacheKey || !this.game?.cache.audio.exists(cacheKey)) return;
    this.music = this.game.sound.add(cacheKey, { loop: true, volume: this.volume * 0.6 });
    this.music.play();
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    const m = this.music as (Phaser.Sound.BaseSound & { setVolume?: (v: number) => void }) | null;
    m?.setVolume?.(this.volume * 0.6);
  }

  private synth(tones: Tone[]): void {
    const ctx = this.context();
    if (ctx?.state !== 'running') return;
    let at = ctx.currentTime;
    for (const tone of tones) {
      const dur = tone.ms / 1000;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(tone.gain * this.volume, at);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      gain.connect(ctx.destination);
      const osc = ctx.createOscillator();
      osc.type = tone.type;
      osc.frequency.setValueAtTime(tone.from, at);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, tone.to), at + dur);
      osc.connect(gain);
      osc.start(at);
      osc.stop(at + dur);
      if (tone.noise) this.noise(ctx, at, dur, tone.gain * 0.6);
      at += dur * 0.8;
    }
  }

  private noise(ctx: AudioContext, at: number, dur: number, level: number): void {
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = level * this.volume;
    src.connect(gain).connect(ctx.destination);
    src.start(at);
  }
}

export const audio = new AudioService();

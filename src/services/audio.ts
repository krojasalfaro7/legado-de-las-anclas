import type Phaser from 'phaser';
import { MusicPlayer } from '../audio/music';
import { type Kit, SFX, type SfxId } from '../audio/sfx';
import { loadOptions } from './storage';

export type { SfxId };

/** For data that names sounds by string (cutscene scripts). */
export function isSfx(id: string): id is SfxId {
  return id in SFX;
}

/** Music sits under the effects so hits and voices stay readable. */
const MUSIC_LEVEL = 0.55;

/**
 * Sound for the whole game. Effects and music are synthesized with WebAudio (audio/sfx.ts,
 * audio/music.ts); a file registered in data/audio.ts and loaded into Phaser's cache as
 * `sfx-<id>` replaces that effect instead.
 */
class AudioService {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private game: Phaser.Game | null = null;
  private kit: Omit<Kit, 'at'> | null = null;
  private readonly pulses = new Map<number, PeriodicWave>();
  volume = loadOptions().volume;
  musicVolume = loadOptions().music;
  readonly music = new MusicPlayer(
    () => this.context(),
    () => this.musicBus,
  );

  attach(game: Phaser.Game, target: Window): void {
    this.game = game;
    // Browsers only allow audio after a user gesture.
    const unlock = (): void => {
      void this.context()
        ?.resume()
        .then(() => this.music.wake());
    };
    target.addEventListener('keydown', unlock);
    target.addEventListener('pointerdown', unlock);
    // A phone in a pocket shouldn't keep playing (and its timers would stutter anyway).
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void this.ctx?.suspend();
      else void this.ctx?.resume();
    });
  }

  private context(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const ctx = new AudioContext();
      this.master = ctx.createGain();
      // A gentle limiter so stacked hits never clip.
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -10;
      limiter.ratio.value = 8;
      this.master.connect(limiter).connect(ctx.destination);
      this.sfxBus = ctx.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus = ctx.createGain();
      this.musicBus.connect(this.master);
      this.ctx = ctx;
      this.applyVolumes();
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
    const ctx = this.context();
    if (ctx?.state !== 'running' || !this.sfxBus) return;
    SFX[id]({ ...this.sfxKit(ctx), at: ctx.currentTime });
  }

  /** Switches the soundtrack (crossfade); `undefined` or `null` fades to silence. */
  playMusic(track: string | null | undefined): void {
    this.context();
    this.music.play(track ?? null);
  }

  /** A short piece in place of the music (victory, game over), then `then` or the old track. */
  sting(track: string, then?: string | null): void {
    this.context();
    this.music.sting(track, then);
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyVolumes();
  }

  setMusicVolume(v: number): void {
    this.musicVolume = Math.max(0, Math.min(1, v));
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.sfxBus?.gain.setTargetAtTime(this.volume, now, 0.03);
    this.musicBus?.gain.setTargetAtTime(this.musicVolume * MUSIC_LEVEL, now, 0.03);
  }

  private sfxKit(ctx: AudioContext): Omit<Kit, 'at'> {
    if (this.kit) return this.kit;
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.kit = {
      ctx,
      out: this.sfxBus as GainNode,
      noise: buf,
      wave: (duty) => {
        let w = this.pulses.get(duty);
        if (!w) {
          const n = 32;
          const real = new Float32Array(n);
          for (let i = 1; i < n; i++) real[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
          w = ctx.createPeriodicWave(real, new Float32Array(n));
          this.pulses.set(duty, w);
        }
        return w;
      },
    };
    return this.kit;
  }
}

export const audio = new AudioService();

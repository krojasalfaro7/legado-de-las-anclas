import { audio } from './audio';
import { loadOptions, normalizeOptions, type Options, saveOptions } from './storage';

/** Live player options, persisted separately from the save game. */
class OptionsService {
  private current: Options = loadOptions();

  get volume(): number {
    return this.current.volume;
  }

  get music(): number {
    return this.current.music;
  }

  get showControls(): boolean {
    return this.current.showControls;
  }

  update(patch: Partial<Options>): void {
    this.current = normalizeOptions({ ...this.current, ...patch });
    audio.setVolume(this.current.volume);
    audio.setMusicVolume(this.current.music);
    saveOptions(this.current);
  }
}

export const options = new OptionsService();

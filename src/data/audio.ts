import type { SfxId } from '../services/audio';

/**
 * Optional audio files under public/assets/audio/. Anything listed here is loaded
 * at boot and replaces the synth fallback (sfx) or plays as zone music.
 * Example: hit: 'sfx/hit.ogg'
 */
export const SFX_FILES: Partial<Record<SfxId, string>> = {};

/** Music keys referenced by `ZoneDef.music`. Example: field: 'music/mist-island.ogg' */
export const MUSIC_FILES: Record<string, string> = {};

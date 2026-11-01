import type { SfxId } from '../services/audio';

/**
 * Optional audio files under public/assets/audio/. Anything listed here is loaded
 * at boot and replaces the synthesized effect.
 * Example: hit: 'sfx/hit.ogg'
 */
export const SFX_FILES: Partial<Record<SfxId, string>> = {};

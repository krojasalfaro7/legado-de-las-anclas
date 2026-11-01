Drop audio files here and register them in `src/data/audio.ts`:

- `SFX_FILES` — sound effects keyed by `SfxId` (see `src/services/audio.ts`). Registered files
  replace the built-in synth sound for that id.
- `MUSIC_FILES` — music tracks; reference them from a zone with `music: '<key>'` in
  `src/data/zones.ts`.

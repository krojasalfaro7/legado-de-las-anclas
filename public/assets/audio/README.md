Drop audio files here and register them in `src/data/audio.ts`:

- `SFX_FILES` — sound effects keyed by `SfxId` (see `src/audio/sfx.ts`). A registered file
  replaces the synthesized sound for that id.

Music is not loaded from files: the soundtrack is written in `src/audio/tracks.ts` and
synthesized at runtime.

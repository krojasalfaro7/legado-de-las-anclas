import { describe, expect, it } from 'vitest';
import { compile } from '../src/audio/song';
import { arpBar, bassBar, chord, midi, parseBar, parseDrums } from '../src/audio/theory';
import { TRACKS } from '../src/audio/tracks';
import { CUTSCENES } from '../src/data/cutscenes';
import { ZONES } from '../src/data/zones';
import type { CutStep } from '../src/systems/cutscene';

describe('music theory', () => {
  it('reads note names and chord symbols', () => {
    expect(midi('C4')).toBe(60);
    expect(midi('A4')).toBe(69);
    expect(midi('F#3')).toBe(54);
    expect(midi('Bb5')).toBe(82);
    expect(chord('Am').tones).toEqual([57, 60, 64]);
    expect(chord('C/G').bass).toBe(midi('G2'));
    expect(() => chord('H7')).toThrow();
  });

  it('turns a written bar into notes, holds and rests', () => {
    expect(parseBar('E5 - . G5', 8)).toEqual([
      { step: 8, len: 2, midi: midi('E5') },
      { step: 11, len: 1, midi: midi('G5') },
    ]);
    expect(parseDrums('k . sh .', 0)).toEqual([
      { step: 0, hit: 'k' },
      { step: 2, hit: 's' },
      { step: 2, hit: 'h' },
    ]);
  });

  it('keeps the accompaniment inside its bar', () => {
    for (const style of ['root', 'pulse', 'octave', 'walk', 'sparse'] as const) {
      for (const e of bassBar('G', style, 6, 12)) {
        expect(e.step).toBeGreaterThanOrEqual(12);
        expect(e.step + e.len).toBeLessThanOrEqual(18);
      }
    }
    for (const style of ['up', 'updown', 'broken', 'pad', 'stab'] as const) {
      for (const e of arpBar('Dm7', style, 8, 0)) expect(e.step + e.len).toBeLessThanOrEqual(8);
    }
  });
});

describe('soundtrack', () => {
  it('every track compiles with whole bars and something to play', () => {
    for (const [id, def] of Object.entries(TRACKS)) {
      const song = compile(def);
      expect(song.length, id).toBe(def.bars.length * def.steps);
      const notes = song.voices.flatMap((v) => v.events);
      expect(notes.length, id).toBeGreaterThan(0);
      for (const n of notes) {
        expect(n.step + n.len, id).toBeLessThanOrEqual(song.length);
        // Inside what a tiny speaker can play without mud or squeal.
        expect(n.midi, id).toBeGreaterThanOrEqual(midi('C1'));
        expect(n.midi, id).toBeLessThanOrEqual(midi('C7'));
      }
    }
  });

  it('every zone and cutscene names a real track', () => {
    for (const zone of Object.values(ZONES)) {
      expect(zone.music, zone.id).toBeDefined();
      expect(TRACKS[zone.music ?? ''], zone.id).toBeDefined();
    }
    const steps = (list: CutStep[]): CutStep[] =>
      list.flatMap((s) => (s.do === 'together' ? steps(s.steps) : [s]));
    for (const cs of CUTSCENES) {
      for (const s of steps(cs.steps)) {
        if (s.do === 'music' && s.id) expect(TRACKS[s.id], cs.id).toBeDefined();
      }
    }
    for (const id of ['title', 'flight', 'boss', 'finale', 'victory', 'gameOver', 'credits']) {
      expect(TRACKS[id], id).toBeDefined();
    }
  });
});

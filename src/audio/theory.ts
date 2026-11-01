/**
 * Just enough music theory to write the soundtrack as text: note names, chord symbols, and the
 * bar patterns the tracks are written in (see audio/tracks.ts).
 */

const LETTERS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** MIDI number of a note name like `C4`, `F#3` or `Bb5` (C4 = 60). */
export function midi(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`Bad note: ${name}`);
  const [, letter, accidental, octave] = m as unknown as [string, string, string, string];
  const shift = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
  return (Number(octave) + 1) * 12 + (LETTERS[letter] ?? 0) + shift;
}

export function freq(midiNote: number): number {
  return 440 * 2 ** ((midiNote - 69) / 12);
}

const QUALITIES: Record<string, readonly number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  '7': [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  add9: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14],
};

/**
 * Pitch classes of a chord symbol (`Am`, `F#dim`, `Bbmaj7`), as MIDI notes rooted in octave 3.
 * A slash names the bass: `C/G`.
 */
export function chord(symbol: string): { root: number; tones: number[]; bass: number } {
  const [main = '', slash] = symbol.split('/');
  const m = /^([A-G][#b]?)(.*)$/.exec(main);
  const intervals = m ? QUALITIES[m[2] ?? ''] : undefined;
  if (!m || !intervals) throw new Error(`Bad chord: ${symbol}`);
  const root = midi(`${m[1]}3`);
  const bass = slash ? midi(`${slash}2`) : root - 12;
  return { root, tones: intervals.map((i) => root + i), bass };
}

/** One sounding note: starts at `step`, lasts `len` steps. */
export interface NoteEvent {
  step: number;
  len: number;
  midi: number;
}

/**
 * A bar written as space-separated steps: a note (`E5`), `-` holds the previous note, `.` is
 * silence. `offset` places the bar in the loop.
 */
export function parseBar(text: string, offset: number): NoteEvent[] {
  const out: NoteEvent[] = [];
  let current: NoteEvent | null = null;
  text
    .trim()
    .split(/\s+/)
    .forEach((tok, i) => {
      if (tok === '-') {
        if (current) current.len++;
        return;
      }
      current = null;
      if (tok === '.') return;
      current = { step: offset + i, len: 1, midi: midi(tok) };
      out.push(current);
    });
  return out;
}

export function barLength(text: string): number {
  return text.trim().split(/\s+/).length;
}

export type DrumHit = 'k' | 's' | 'h' | 'o' | 't';

/** Drum bar: one token per step, any mix of k(ick) s(nare) h(at) o(pen hat) t(om), `.` = none. */
export function parseDrums(text: string, offset: number): Array<{ step: number; hit: DrumHit }> {
  const out: Array<{ step: number; hit: DrumHit }> = [];
  text
    .trim()
    .split(/\s+/)
    .forEach((tok, i) => {
      for (const c of tok)
        if ('ksoht'.includes(c)) out.push({ step: offset + i, hit: c as DrumHit });
    });
  return out;
}

/** How the accompaniment plays a chord across one bar of `steps` steps. */
export type BassStyle = 'root' | 'pulse' | 'octave' | 'walk' | 'sparse' | 'none';
export type ArpStyle = 'up' | 'updown' | 'broken' | 'pad' | 'stab' | 'none';

export function bassBar(
  symbol: string,
  style: BassStyle,
  steps: number,
  offset: number,
): NoteEvent[] {
  const { bass, tones } = chord(symbol);
  const fifth = bass + ((tones[2] ?? tones[0] ?? 0) - (tones[0] ?? 0));
  const half = Math.max(1, Math.floor(steps / 2));
  switch (style) {
    case 'root':
      return [
        { step: offset, len: half, midi: bass },
        { step: offset + half, len: steps - half, midi: bass },
      ];
    case 'pulse':
      return Array.from({ length: steps }, (_, i) => ({ step: offset + i, len: 1, midi: bass }));
    case 'octave':
      return Array.from({ length: steps }, (_, i) => ({
        step: offset + i,
        len: 1,
        midi: i % 2 ? bass + 12 : bass,
      }));
    case 'walk': {
      const line = [bass, fifth, bass + 12, fifth];
      const each = Math.max(1, Math.floor(steps / 4));
      return line.map((m, i) => ({ step: offset + i * each, len: each, midi: m }));
    }
    case 'sparse':
      return [{ step: offset, len: Math.max(1, steps - 1), midi: bass }];
    case 'none':
      return [];
  }
}

export function arpBar(
  symbol: string,
  style: ArpStyle,
  steps: number,
  offset: number,
): NoteEvent[] {
  // Voiced around middle C, where the arpeggio sits under the melody.
  const tones = chord(symbol).tones.map((m) => m + 12);
  const ring = [...tones, (tones[0] ?? 60) + 12];
  switch (style) {
    case 'up':
      return Array.from({ length: steps }, (_, i) => ({
        step: offset + i,
        len: 1,
        midi: ring[i % ring.length] ?? 60,
      }));
    case 'updown': {
      const cycle = [...ring, ...ring.slice(1, -1).reverse()];
      return Array.from({ length: steps }, (_, i) => ({
        step: offset + i,
        len: 1,
        midi: cycle[i % cycle.length] ?? 60,
      }));
    }
    case 'broken': {
      const order = [0, 2, 1, 2];
      return Array.from({ length: steps }, (_, i) => ({
        step: offset + i,
        len: 1,
        midi: tones[order[i % order.length] ?? 0] ?? 60,
      }));
    }
    case 'pad':
      return tones.slice(0, 3).map((m) => ({ step: offset, len: steps, midi: m }));
    case 'stab': {
      const beats = [0, Math.floor(steps / 2)].filter((s) => s < steps);
      return beats.flatMap((b) =>
        tones.slice(0, 3).map((m) => ({ step: offset + b, len: 1, midi: m })),
      );
    }
    case 'none':
      return [];
  }
}

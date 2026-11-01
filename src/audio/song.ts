import {
  type ArpStyle,
  arpBar,
  type BassStyle,
  barLength,
  bassBar,
  type DrumHit,
  type NoteEvent,
  parseBar,
  parseDrums,
} from './theory';

export type Wave = 'pulse12' | 'pulse25' | 'pulse50' | 'triangle' | 'saw';

/**
 * One bar of a track: its chord (two chords split the bar: `'F G'`) and the melody, one token
 * per step (see theory.parseBar). Bars without a melody rest.
 */
export interface Bar {
  c: string;
  m?: string;
}

export interface TrackDef {
  bpm: number;
  /** Steps per bar: 8 = 4/4 in eighths, 6 = 6/8. */
  steps: number;
  bars: Bar[];
  bass: BassStyle;
  arp: ArpStyle;
  /** Drum bars, cycled; the last bar of the loop uses `fill` if given. */
  drums?: string[];
  fill?: string;
  lead?: Wave;
  /** Semitones to move the written melody (e.g. -12 to write high and play low). */
  leadShift?: number;
  leadVol?: number;
  arpVol?: number;
  bassVol?: number;
  drumVol?: number;
  /** Echo on the lead, 0..1 (caves and open skies get more). */
  echo?: number;
  /** Low-pass on the whole track, Hz (underground tracks sound muffled). */
  cutoff?: number;
  /** Stingers (game over, victory) play once. */
  once?: boolean;
}

export interface Voice {
  wave: Wave;
  vol: number;
  events: NoteEvent[];
  /** Lead voices get vibrato and the echo send. */
  lead: boolean;
}

export interface Song {
  def: TrackDef;
  length: number;
  voices: Voice[];
  drums: Array<{ step: number; hit: DrumHit }>;
}

/** Turns a written track into timed events (steps from the loop start). */
export function compile(def: TrackDef): Song {
  const lead: NoteEvent[] = [];
  const bass: NoteEvent[] = [];
  const arp: NoteEvent[] = [];
  const drums: Song['drums'] = [];
  def.bars.forEach((bar, i) => {
    const at = i * def.steps;
    if (bar.m) {
      if (barLength(bar.m) !== def.steps)
        throw new Error(`Bar ${i + 1} has ${barLength(bar.m)} steps, expected ${def.steps}`);
      for (const e of parseBar(bar.m, at)) lead.push({ ...e, midi: e.midi + (def.leadShift ?? 0) });
    }
    const chords = bar.c.trim().split(/\s+/);
    const each = def.steps / chords.length;
    chords.forEach((c, j) => {
      const off = at + Math.round(j * each);
      const len = Math.round((j + 1) * each) - Math.round(j * each);
      bass.push(...bassBar(c, def.bass, len, off));
      arp.push(...arpBar(c, def.arp, len, off));
    });
    if (def.drums?.length) {
      const last = i === def.bars.length - 1 && def.fill;
      const pattern = last ? (def.fill as string) : (def.drums[i % def.drums.length] as string);
      drums.push(...parseDrums(pattern, at));
    }
  });
  return {
    def,
    length: def.bars.length * def.steps,
    voices: [
      { wave: def.lead ?? 'pulse25', vol: def.leadVol ?? 0.16, events: lead, lead: true },
      { wave: 'pulse12', vol: def.arpVol ?? 0.05, events: arp, lead: false },
      { wave: 'triangle', vol: def.bassVol ?? 0.22, events: bass, lead: false },
    ],
    drums,
  };
}

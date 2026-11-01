import type Phaser from 'phaser';

export interface PortraitView {
  scale: number;
  /** The part of the frame to show, in frame pixels. */
  x: number;
  y: number;
  w: number;
  h: number;
}

const tops = new Map<string, number>();

/** First row with ink in the frame's middle band, so tall frames don't show empty air. */
function artTop(scene: Phaser.Scene, key: string, frame: string | number, fw: number, fh: number) {
  const id = `${key}:${frame}`;
  const cached = tops.get(id);
  if (cached !== undefined) return cached;
  let top = 0;
  scan: for (let y = 0; y < fh; y++)
    for (let x = Math.floor(fw / 4); x < (fw * 3) / 4; x += 2)
      if (scene.textures.getPixelAlpha(x, y, key, frame) > 0) {
        top = y;
        break scan;
      }
  tops.set(id, top);
  return top;
}

/**
 * How to show a sprite frame as a portrait in a `boxW`×`boxH` box: people at 2x from the top of
 * the head; big sprites (heavies, golems, giants: already drawn large) at 1x, centered, starting
 * where the art starts, so a colossus shows its head and shoulders instead of a dark close-up.
 */
export function portraitView(
  scene: Phaser.Scene,
  key: string,
  frame: string | number,
  boxW: number,
  boxH: number,
): PortraitView {
  const f = scene.textures.getFrame(key, frame);
  const fw = f?.width ?? 24;
  const fh = f?.height ?? 32;
  const scale = fw <= 24 ? 2 : 1;
  const w = Math.min(fw, Math.floor(boxW / scale));
  const h = Math.min(fh, Math.floor(boxH / scale));
  const top = artTop(scene, key, frame, fw, fh);
  return {
    scale,
    x: Math.round((fw - w) / 2),
    y: Math.max(0, Math.min(top - 1, fh - h)),
    w,
    h,
  };
}

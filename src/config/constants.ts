/**
 * Smallest view height in pixels. The user first chose ~16 tiles, then (after comparing with GBA
 * footage, where a 30 px fighter fills a 160 px screen) a closer camera: ~13 tiles at 1080p.
 */
const MIN_VIEW_HEIGHT = 200;
/** Widest view: the hub map is 480px wide, wider views would show black margins there. */
const MAX_VIEW_WIDTH = 480;

/**
 * The internal resolution follows the monitor's aspect ratio so fullscreen has no black bars,
 * and divides it by a whole number so every game pixel is the same size (e.g. 1920x1080 -> 384x216
 * at 5x, 1366x768 -> 456x256 at 3x). Fixed for the session; outside a browser it is 384x256.
 */
function viewSize(): { width: number; height: number } {
  if (typeof window === 'undefined') return { width: 384, height: 256 };
  if (window.matchMedia?.('(pointer: coarse)').matches) return touchViewSize();
  const { width: sw, height: sh } = window.screen;
  const zoom = Math.max(1, Math.floor(sh / MIN_VIEW_HEIGHT));
  return {
    width: Math.min(MAX_VIEW_WIDTH, Math.max(384, Math.ceil(sw / zoom))),
    height: Math.max(MIN_VIEW_HEIGHT, Math.ceil(sh / zoom)),
  };
}

/** Phone and tablet view height: a little closer than the desktop's, for small screens. */
const TOUCH_VIEW_HEIGHT = 216;

/**
 * Phones and tablets are played in landscape whichever way they are held now, and their pixels
 * are too small for whole-number zoom to matter: fit ~13.5 tiles of height, width by aspect.
 */
function touchViewSize(): { width: number; height: number } {
  const long = Math.max(window.screen.width, window.screen.height);
  const short = Math.min(window.screen.width, window.screen.height);
  const width = Math.round((TOUCH_VIEW_HEIGHT * long) / short);
  return { width: Math.min(MAX_VIEW_WIDTH, Math.max(384, width)), height: TOUCH_VIEW_HEIGHT };
}

const VIEW = viewSize();
export const GAME_WIDTH = VIEW.width;
export const GAME_HEIGHT = VIEW.height;
export const TILE_SIZE = 16;
export const GAME_TITLE = 'Legado de las Anclas';

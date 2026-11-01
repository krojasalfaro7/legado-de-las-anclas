import { input } from './input';

/** Phones and tablets: a coarse pointer and no hover. */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(pointer: coarse)').matches ?? false;
}

/** Thumb stick: how far (CSS px) the thumb travels for a full push, and the dead middle. */
const STICK_RADIUS = 46;
const STICK_DEADZONE = 0.22;
/** A touch shorter and stiller than this is a tap: it confirms (advances dialogue, menus). */
const TAP_MS = 220;
const TAP_SLOP = 10;

interface ButtonSpec {
  label: string;
  /** Keyboard codes held while pressed (two for the ki charge, A+S). */
  codes: readonly string[];
  /** Grid position class in the right-hand cluster or the top bar. */
  cls: string;
}

/**
 * The right thumb's cluster, laid out like a handheld: the punch biggest and nearest the thumb,
 * special and guard beside it, flight above. Labels match the keyboard hints.
 */
const ACTION_BUTTONS: readonly ButtonSpec[] = [
  { label: 'Golpe', codes: ['KeyD'], cls: 'tc-attack' },
  { label: 'Especial', codes: ['KeyS'], cls: 'tc-ki' },
  { label: 'Guardia', codes: ['KeyA'], cls: 'tc-block' },
  { label: 'Volar', codes: ['ShiftLeft'], cls: 'tc-fly' },
  { label: 'Cargar', codes: ['KeyA', 'KeyS'], cls: 'tc-charge' },
];

const BAR_BUTTONS: readonly ButtonSpec[] = [
  { label: 'Elegir', codes: ['KeyQ'], cls: '' },
  { label: 'Cambiar', codes: ['KeyR'], cls: '' },
  { label: 'Usar', codes: ['KeyE'], cls: '' },
  { label: 'Lente', codes: ['Tab'], cls: '' },
  { label: 'Pausa', codes: ['Escape'], cls: '' },
];

const CSS = `
#tc { position: fixed; inset: 0; pointer-events: none; z-index: 5; user-select: none;
  -webkit-user-select: none; -webkit-touch-callout: none; touch-action: none;
  font: 600 13px/1 system-ui, sans-serif; color: #fff; }
#tc .tc-tap { position: absolute; inset: 0; pointer-events: auto; touch-action: none; }
#tc .tc-pad, #tc .tc-bar { transition: opacity .2s; }
#tc.tc-dim .tc-pad, #tc.tc-dim .tc-bar { opacity: .35; }
#tc.tc-title .tc-bar { top: calc(env(safe-area-inset-top) + 8px); }
#tc.tc-title .tc-bar button:not(.tc-full) { display: none; }
#tc.tc-title .tc-pad button:not(.tc-attack) { display: none; }
#tc .tc-zone { position: absolute; left: 0; top: 18%; width: 46%; bottom: 0;
  pointer-events: auto; touch-action: none; }
#tc .tc-base, #tc .tc-knob { position: absolute; border-radius: 50%; pointer-events: none;
  transform: translate(-50%, -50%); }
#tc .tc-base { width: ${STICK_RADIUS * 2 + 24}px; height: ${STICK_RADIUS * 2 + 24}px;
  background: rgba(255,255,255,.08); border: 2px solid rgba(255,255,255,.28); }
#tc .tc-knob { width: 52px; height: 52px; background: rgba(255,240,200,.35);
  border: 2px solid rgba(255,255,255,.55); }
#tc .tc-pad { position: absolute; right: max(10px, env(safe-area-inset-right));
  bottom: max(10px, env(safe-area-inset-bottom)); width: 220px; height: 190px; }
#tc button { position: absolute; pointer-events: auto; touch-action: none; border-radius: 50%;
  border: 2px solid rgba(255,255,255,.5); background: rgba(20,24,40,.42); color: #fff;
  font: inherit; text-shadow: 0 1px 2px #000; padding: 0; -webkit-tap-highlight-color: transparent; }
#tc button.tc-on { background: rgba(255,214,90,.55); border-color: #ffe9a0; }
#tc .tc-attack { width: 84px; height: 84px; right: 0; bottom: 6px; font-size: 15px;
  background: rgba(200,60,50,.45); }
#tc .tc-ki { width: 66px; height: 66px; right: 96px; bottom: 0; background: rgba(60,110,210,.45); }
#tc .tc-block { width: 58px; height: 58px; right: 150px; bottom: 74px; }
#tc .tc-fly { width: 62px; height: 62px; right: 10px; bottom: 104px; background: rgba(70,170,150,.4); }
#tc .tc-charge { width: 54px; height: 54px; right: 82px; bottom: 82px; font-size: 12px; }
#tc .tc-bar { position: absolute; top: calc(env(safe-area-inset-top) + 13%);
  right: max(8px, env(safe-area-inset-right)); display: flex; gap: 6px; }
#tc .tc-bar button { position: static; border-radius: 12px; height: 30px; padding: 0 10px;
  font-size: 12px; }
#tc-rotate { position: fixed; inset: 0; z-index: 6; display: none; align-items: center;
  justify-content: center; flex-direction: column; gap: 14px; background: #0b0e1a; color: #f4e9c8;
  font: 600 18px system-ui, sans-serif; text-align: center; padding: 24px; }
#tc-rotate .tc-phone { width: 46px; height: 80px; border: 4px solid #f4e9c8; border-radius: 9px;
  animation: tc-turn 1.6s ease-in-out infinite; }
@keyframes tc-turn { 0%, 30% { transform: rotate(0) } 60%, 100% { transform: rotate(-90deg) } }
@media (orientation: portrait) { #tc-rotate { display: flex; } }
`;

/**
 * On-screen controls for phones and tablets, drawn in the DOM over the canvas so they stay crisp
 * and take several fingers at once. Buttons hold keyboard codes (services/input.ts), so menus,
 * dialogue and every binding work exactly as with the keyboard.
 */
export class TouchControls {
  private root!: HTMLDivElement;
  private base!: HTMLDivElement;
  private knob!: HTMLDivElement;
  private stickPointer: number | null = null;
  private origin = { x: 0, y: 0 };
  private stickDownAt = 0;
  private stickTravel = 0;

  constructor(private readonly toggleFullscreen: () => void) {}

  attach(): void {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.append(style);

    this.root = document.createElement('div');
    this.root.id = 'tc';
    this.root.append(this.tapLayer(), this.stickZone(), this.pad(), this.bar());
    document.body.append(this.root);

    const rotate = document.createElement('div');
    rotate.id = 'tc-rotate';
    rotate.innerHTML = '<div class="tc-phone"></div><div>Gira el teléfono para jugar</div>';
    document.body.append(rotate);

    // No page scrolling, zooming or context menus while playing.
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  }

  /** Dialogue, menus and cutscenes: fade the buttons so they don't cover the text. */
  setDim(dim: boolean): void {
    this.root?.classList.toggle('tc-dim', dim);
  }

  /** The title screen keeps only "Golpe" (accept) and fullscreen, clear of the logo and text. */
  setTitle(on: boolean): void {
    this.root?.classList.toggle('tc-title', on);
  }

  /** Space is only "confirm", so a tap anywhere can press it without doing anything in play. */
  private tap(): void {
    input.touchKey('Space', true);
    window.setTimeout(() => input.touchKey('Space', false), 90);
  }

  private tapLayer(): HTMLDivElement {
    const layer = document.createElement('div');
    layer.className = 'tc-tap';
    layer.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.tap();
    });
    return layer;
  }

  private stickZone(): HTMLDivElement {
    const zone = document.createElement('div');
    zone.className = 'tc-zone';
    this.base = document.createElement('div');
    this.base.className = 'tc-base';
    this.knob = document.createElement('div');
    this.knob.className = 'tc-knob';
    for (const el of [this.base, this.knob]) el.style.display = 'none';
    zone.append(this.base, this.knob);

    zone.addEventListener('pointerdown', (e) => {
      if (this.stickPointer !== null) return;
      this.stickPointer = e.pointerId;
      this.stickDownAt = e.timeStamp;
      this.stickTravel = 0;
      zone.setPointerCapture(e.pointerId);
      // The stick appears under the thumb, wherever it lands.
      const r = zone.getBoundingClientRect();
      this.origin = { x: e.clientX - r.left, y: e.clientY - r.top };
      this.place(this.base, this.origin.x, this.origin.y);
      this.place(this.knob, this.origin.x, this.origin.y);
      for (const el of [this.base, this.knob]) el.style.display = 'block';
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stickPointer) return;
      const r = zone.getBoundingClientRect();
      let dx = e.clientX - r.left - this.origin.x;
      let dy = e.clientY - r.top - this.origin.y;
      const len = Math.hypot(dx, dy);
      this.stickTravel = Math.max(this.stickTravel, len);
      if (len > STICK_RADIUS) {
        dx *= STICK_RADIUS / len;
        dy *= STICK_RADIUS / len;
      }
      this.place(this.knob, this.origin.x + dx, this.origin.y + dy);
      const mag = Math.min(1, len / STICK_RADIUS);
      input.setTouchStick(
        mag < STICK_DEADZONE ? { x: 0, y: 0 } : { x: dx / STICK_RADIUS, y: dy / STICK_RADIUS },
      );
    });
    const release = (e: PointerEvent) => {
      if (e.pointerId !== this.stickPointer) return;
      this.stickPointer = null;
      input.setTouchStick({ x: 0, y: 0 });
      if (e.timeStamp - this.stickDownAt < TAP_MS && this.stickTravel < TAP_SLOP) this.tap();
      for (const el of [this.base, this.knob]) el.style.display = 'none';
    };
    zone.addEventListener('pointerup', release);
    zone.addEventListener('pointercancel', release);
    return zone;
  }

  private place(el: HTMLElement, x: number, y: number): void {
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

  private pad(): HTMLDivElement {
    const pad = document.createElement('div');
    pad.className = 'tc-pad';
    for (const spec of ACTION_BUTTONS) pad.append(this.button(spec));
    return pad;
  }

  private bar(): HTMLDivElement {
    const bar = document.createElement('div');
    bar.className = 'tc-bar';
    for (const spec of BAR_BUTTONS) bar.append(this.button(spec));
    // iPhones have no fullscreen API: there, "add to home screen" runs the game fullscreen.
    if (document.fullscreenEnabled) bar.append(this.fullscreenButton());
    return bar;
  }

  private fullscreenButton(): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = 'tc-full';
    b.textContent = 'Pantalla';
    // Fullscreen (and the landscape lock) must start inside the gesture itself.
    b.addEventListener('pointerup', () => {
      this.toggleFullscreen();
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (o: string) => Promise<void>;
      };
      orientation.lock?.('landscape').catch(() => {});
    });
    return b;
  }

  private button(spec: ButtonSpec): HTMLButtonElement {
    const b = document.createElement('button');
    b.textContent = spec.label;
    if (spec.cls) b.className = spec.cls;
    let held = false;
    const set = (down: boolean) => {
      if (held === down) return;
      held = down;
      b.classList.toggle('tc-on', down);
      for (const code of spec.codes) input.touchKey(code, down);
      if (down) navigator.vibrate?.(8);
    };
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      set(true);
    });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'] as const)
      b.addEventListener(ev, () => set(false));
    return b;
  }
}

/** A pause-menu tab. Views own their game objects and destroy them on close. */
export interface TabView {
  update(): void;
  destroy(): void;
  /** Return true while a sub-dialog inside the tab should get the cancel key. */
  capturesCancel?(): boolean;
  /** Return true while the tab uses left/right itself (e.g. sliders). */
  capturesHorizontal?(): boolean;
}

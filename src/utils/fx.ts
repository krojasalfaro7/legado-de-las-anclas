import Phaser from 'phaser';

/** White silhouette flash used as hit feedback. */
export function flashWhite(target: Phaser.GameObjects.Sprite, ms = 80): void {
  target.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
  target.scene.time.delayedCall(ms, () => {
    if (target.active) target.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
  });
}

/**
 * Fills the sprite with one color for a moment, then lets the color drain away (struck enemies:
 * about 4 frames solid red, then 5 more fading through pink, like the reference footage).
 */
export function flashTint(
  target: Phaser.GameObjects.Sprite,
  color: number,
  ms = 70,
  fadeMs = 90,
): void {
  target.setTint(color).setTintMode(Phaser.TintModes.FILL);
  target.scene.time.delayedCall(ms, () => {
    if (!target.active) return;
    target.setTintMode(Phaser.TintModes.MULTIPLY);
    const from = Phaser.Display.Color.IntegerToColor(color);
    target.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: fadeMs,
      onUpdate: (tw) => {
        if (!target.active) return;
        const k = tw.getValue() ?? 1;
        const mix = (c: number) => Math.round(c + (255 - c) * k);
        target.setTint(
          Phaser.Display.Color.GetColor(mix(from.red), mix(from.green), mix(from.blue)),
        );
      },
      onComplete: () => {
        if (target.active) target.clearTint();
      },
    });
  });
}

/** Jitters a struck sprite sideways for `ms` (sells the impact during hit-stop). */
export function shakeSprite(target: Phaser.GameObjects.Sprite, ms: number, px = 1): void {
  const baseX = target.x;
  let flip = 1;
  const ev = target.scene.time.addEvent({
    delay: 30,
    repeat: Math.max(0, Math.floor(ms / 30) - 1),
    callback: () => {
      if (!target.active) return;
      flip = -flip;
      target.x = baseX + flip * px;
    },
  });
  target.scene.time.delayedCall(ms + 5, () => {
    ev.remove();
    // Only undo our own offset: physics may have moved the body since.
    if (target.active && Math.abs(target.x - baseX) <= px) target.x = baseX;
  });
}

/**
 * White speed streaks behind a punch or kick: `x`/`y` is the fist (or foot) and three short
 * lines trail back from it along `angle`, nudge forward with it and fade in about 6 frames.
 * They end at the fist so the blow, not the streaks, reads as what hits (user feedback).
 */
export function swingTrail(
  scene: Phaser.Scene,
  x: number,
  y: number,
  angle: number,
  length = 12,
): void {
  const g = scene.add.graphics().setDepth(y + 2001);
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const nx = -dy;
  const ny = dx;
  g.lineStyle(1, 0xffffff, 1);
  for (const [off, len] of [
    [-3, length * 0.6],
    [0, length],
    [3, length * 0.7],
  ] as const) {
    const ex = x + nx * off * 0.7;
    const ey = y + ny * off * 0.7;
    g.lineBetween(ex - dx * len, ey - dy * len, ex, ey);
  }
  scene.tweens.add({
    targets: g,
    x: dx * 2,
    y: dy * 2,
    alpha: 0,
    duration: 100,
    onComplete: () => g.destroy(),
  });
}

/** A white flash that pops where a blow lands. */
export function impactFlash(scene: Phaser.Scene, x: number, y: number, size = 0.5): void {
  const f = scene.add
    .image(x, y, 'glow')
    .setDepth(y + 2002)
    .setScale(size * 0.4)
    .setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({
    targets: f,
    scale: size,
    alpha: 0,
    duration: 120,
    ease: 'Quad.easeOut',
    onComplete: () => f.destroy(),
  });
}

/** Defeated enemies vanish in a puff of dust. */
export function dustPuff(scene: Phaser.Scene, x: number, y: number, count = 7): void {
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count + Math.random() * 0.6;
    const d = scene.add
      .image(x + Math.cos(a) * 3, y + Math.sin(a) * 2, 'glow')
      .setTint(i % 2 ? 0xd8c8a8 : 0xb8a888)
      .setScale(0.25)
      .setDepth(y + 2000);
    scene.tweens.add({
      targets: d,
      x: d.x + Math.cos(a) * (8 + Math.random() * 6),
      y: d.y + Math.sin(a) * 5 - 6,
      scale: 0.55,
      alpha: 0,
      duration: 380 + Math.random() * 160,
      ease: 'Quad.easeOut',
      onComplete: () => d.destroy(),
    });
  }
}

export function sparkBurst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
  count = 6,
): void {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const dist = 8 + Math.random() * 8;
    const s = scene.add
      .image(x, y, 'spark')
      .setTint(color)
      .setDepth(y + 2000)
      .setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: s,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      alpha: 0,
      scale: 0.4,
      duration: 220 + Math.random() * 120,
      onComplete: () => s.destroy(),
    });
  }
}

/**
 * A ki blast landing: a colored shockwave ring, a hot white core and sparks in the blast's color.
 * Heavy blasts get a bigger ring and more sparks.
 */
export function kiImpact(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
  heavy = false,
): void {
  const depth = y + 2003;
  const ring = scene.add.graphics().setDepth(depth).setBlendMode(Phaser.BlendModes.ADD);
  const maxR = heavy ? 18 : 10;
  const state = { r: 2, a: 1 };
  scene.tweens.add({
    targets: state,
    r: maxR,
    a: 0,
    duration: heavy ? 260 : 170,
    ease: 'Quad.easeOut',
    onUpdate: () => {
      ring.clear();
      ring.lineStyle(heavy ? 3 : 2, color, state.a);
      ring.strokeEllipse(x, y, state.r * 2, state.r * 1.4);
    },
    onComplete: () => ring.destroy(),
  });
  const core = scene.add
    .image(x, y, 'glow')
    .setTint(color)
    .setDepth(depth)
    .setScale(heavy ? 0.5 : 0.3)
    .setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({
    targets: core,
    scale: heavy ? 1.3 : 0.7,
    alpha: 0,
    duration: heavy ? 220 : 140,
    onComplete: () => core.destroy(),
  });
  impactFlash(scene, x, y, heavy ? 0.9 : 0.5);
  sparkBurst(scene, x, y, color, heavy ? 10 : 5);
}

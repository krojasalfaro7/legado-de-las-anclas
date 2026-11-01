/** Checks a hand-drawn sheet against docs/SPRITES.md. Pure: no file access. */
import {
  FACINGS,
  type Facing,
  type FrameSize,
  GROUNDED_POSES,
  is15BitChannel,
  MAX_COLORS,
  POSES,
  type Pose,
  sheetSize,
} from '../../src/ui/spriteSpec.ts';
import type { RgbaImage } from '../png.ts';

export const FACING_NAMES: Record<Facing, string> = {
  down: 'abajo',
  left: 'izquierda',
  right: 'derecha',
  up: 'arriba',
};

/** Spanish pose names and the two-letter codes printed on the templates. */
export const POSE_NAMES: Record<Pose, { name: string; code: string }> = {
  idle: { name: 'reposo 1', code: 'R1' },
  idle2: { name: 'reposo 2', code: 'R2' },
  walk1: { name: 'paso 1', code: 'P1' },
  walk2: { name: 'paso 2', code: 'P2' },
  walk3: { name: 'paso 3', code: 'P3' },
  walk4: { name: 'paso 4', code: 'P4' },
  attack: { name: 'golpe 1', code: 'G1' },
  attack2: { name: 'golpe 2', code: 'G2' },
  attack3: { name: 'golpe 3', code: 'G3' },
  cast: { name: 'ki', code: 'KI' },
  block: { name: 'bloqueo', code: 'BL' },
  hurt: { name: 'daño', code: 'DA' },
  fly: { name: 'vuelo 1', code: 'V1' },
  fly2: { name: 'vuelo 2', code: 'V2' },
  cheer: { name: 'recoger objeto', code: 'OB' },
};

export interface SheetReport {
  errors: string[];
  warnings: string[];
}

const hex = (r: number, g: number, b: number): string =>
  `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;

function frameLabel(facing: Facing, pose: Pose): string {
  return `fila «${FACING_NAMES[facing]}», pose «${POSE_NAMES[pose].name}»`;
}

export function validateSheet(img: RgbaImage, frame: FrameSize): SheetReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const size = sheetSize(frame);
  if (img.width !== size.w || img.height !== size.h) {
    errors.push(
      `mide ${img.width}×${img.height} px; debe medir ${size.w}×${size.h} ` +
        `(${POSES.length} poses de ${frame.w} px × ${FACINGS.length} direcciones de ${frame.h} px)`,
    );
    return { errors, warnings };
  }

  const colors = new Set<string>();
  let semi = 0;
  let firstSemi = '';
  let off15 = 0;
  let firstOff15 = '';
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const [r, g, b, a] = img.get(x, y);
      if (a === 0) continue;
      if (a !== 255) {
        if (semi++ === 0) firstSemi = `(${x}, ${y})`;
        continue;
      }
      if (![r, g, b].every(is15BitChannel) && off15++ === 0)
        firstOff15 = `${hex(r, g, b)} en (${x}, ${y})`;
      colors.add(hex(r, g, b));
    }
  }
  if (semi > 0)
    errors.push(
      `${semi} píxeles semitransparentes (el primero en ${firstSemi}): cada píxel debe ser opaco o transparente`,
    );
  if (off15 > 0)
    errors.push(
      `${off15} píxeles con colores fuera de 15 bits (p. ej. ${firstOff15}): ` +
        'cada canal debe ser un múltiplo de 8 (0, 8, …, 248) o su versión expandida (…, 255)',
    );
  if (colors.size > MAX_COLORS)
    errors.push(
      `usa ${colors.size} colores opacos; el máximo es ${MAX_COLORS} más el transparente`,
    );

  for (const facing of FACINGS) {
    for (const pose of POSES) {
      const ox = POSES.indexOf(pose) * frame.w;
      const oy = FACINGS.indexOf(facing) * frame.h;
      let lowest = -1;
      for (let y = 0; y < frame.h; y++) {
        for (let x = 0; x < frame.w; x++) if (img.get(ox + x, oy + y)[3] > 0) lowest = y;
      }
      if (lowest < 0) {
        errors.push(`frame vacío: ${frameLabel(facing, pose)} (x ${ox}, y ${oy})`);
      } else if (GROUNDED_POSES.includes(pose) && lowest !== frame.h - 1) {
        warnings.push(
          `${frameLabel(facing, pose)}: los pies llegan a la fila ${lowest} del frame; ` +
            `deben tocar la última (${frame.h - 1}) o el personaje flotará o se hundirá`,
        );
      }
    }
  }
  return { errors, warnings };
}

/**
 * Validates hand-drawn sheets in public/assets/sprites/ (see docs/SPRITES.md) and writes
 * manifest.json listing the valid ones; the game loads only those and generates the rest.
 *
 * `npm run sprites:check` exits with 1 if a sheet is invalid. `--no-fail` (used before dev and
 * build) only reports, so a broken sheet never stops the game: it falls back to the generated one.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPRITE_DIR, type SpriteManifest } from '../src/ui/spriteSpec.ts';
import { decodePng } from './png.ts';
import { sheetCatalog } from './sprites/catalog.ts';
import { validateSheet } from './sprites/validate.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'public', SPRITE_DIR);
const manifestPath = join(dir, 'manifest.json');
const noFail = process.argv.includes('--no-fail');

const catalog = new Map(sheetCatalog().map((e) => [e.key, e]));
const files = existsSync(dir)
  ? readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith('.png'))
      .sort()
  : [];

const manifest: SpriteManifest = { sheets: {} };
let invalid = 0;
let unknownSeen = false;

for (const file of files) {
  const key = file.replace(/\.png$/i, '');
  const entry = catalog.get(key);
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!entry) {
    errors.push('el nombre no corresponde a ningún personaje, NPC ni enemigo');
    unknownSeen = true;
  } else {
    try {
      const report = validateSheet(decodePng(readFileSync(join(dir, file))), entry.frame);
      errors.push(...report.errors);
      warnings.push(...report.warnings);
    } catch (e) {
      errors.push(`no se pudo leer: ${(e as Error).message}`);
    }
  }
  const who = entry ? ` — ${entry.label}, ${entry.frame.w}×${entry.frame.h}` : '';
  console.log(`${errors.length ? '✗' : '✓'} ${file}${who}`);
  for (const e of errors) console.log(`    error: ${e}`);
  for (const w of warnings) console.log(`    aviso: ${w}`);
  if (errors.length || !entry) {
    invalid++;
    continue;
  }
  manifest.sheets[key] = { file, frameWidth: entry.frame.w, frameHeight: entry.frame.h };
}

if (unknownSeen) {
  console.log('\nNombres válidos (<nombre>.png):');
  for (const e of catalog.values())
    console.log(`    ${e.key}  (${e.label}, ${e.frame.w}×${e.frame.h})`);
}

const json = `${JSON.stringify(manifest, null, 2)}\n`;
const previous = existsSync(manifestPath) ? readFileSync(manifestPath, 'utf8') : '';
if (json !== previous) writeFileSync(manifestPath, json);

const valid = Object.keys(manifest.sheets).length;
if (files.length === 0) console.log('sprites: no hay hojas dibujadas; se usan las generadas.');
else
  console.log(
    `sprites: ${valid} válida(s), ${invalid} con errores` +
      (invalid ? ' (para esas se usa la hoja generada)' : ''),
  );
if (invalid && !noFail) process.exit(1);

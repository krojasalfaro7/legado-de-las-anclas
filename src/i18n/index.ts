import { es } from './es';

export type StringKey = keyof typeof es;

const table: Record<string, string> = es;

/** Looks up a string and replaces `{name}` placeholders. */
export function t(key: StringKey, params?: Record<string, string | number>): string {
  const raw = table[key] ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, p: string) => String(params[p] ?? `{${p}}`));
}

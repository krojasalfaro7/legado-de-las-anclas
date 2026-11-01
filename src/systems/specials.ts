/**
 * The special-ability selector: a character's ki techniques and transformations in one
 * cyclable list. The ki button runs whatever is selected.
 */
export type Special = { kind: 'technique'; id: string } | { kind: 'transform'; id: string };

export function specialsOf(
  techniques: readonly string[],
  transformations: readonly { id: string }[],
): Special[] {
  return [
    ...techniques.map((id): Special => ({ kind: 'technique', id })),
    ...transformations.map((tr): Special => ({ kind: 'transform', id: tr.id })),
  ];
}

/** Wraps in both directions; 0 for an empty list. */
export function cycleIndex(index: number, count: number, dir: 1 | -1 = 1): number {
  if (count <= 0) return 0;
  return (((index + dir) % count) + count) % count;
}

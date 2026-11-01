import type Phaser from 'phaser';

type TiledObject = Phaser.Types.Tilemaps.TiledObject;
type PropValue = string | number | boolean;

/** Reads a Tiled custom property from an object (Tiled stores them as an array). */
export function prop<T extends PropValue>(obj: TiledObject, name: string): T | undefined;
export function prop<T extends PropValue>(obj: TiledObject, name: string, fallback: T): T;
export function prop<T extends PropValue>(
  obj: TiledObject,
  name: string,
  fallback?: T,
): T | undefined {
  const props = obj.properties as Array<{ name: string; value: PropValue }> | undefined;
  const found = props?.find((p) => p.name === name);
  return (found?.value as T | undefined) ?? fallback;
}

export function mapProp<T extends PropValue>(
  map: Phaser.Tilemaps.Tilemap,
  name: string,
): T | undefined {
  const props = map.properties as Array<{ name: string; value: PropValue }> | undefined;
  return props?.find((p) => p.name === name)?.value as T | undefined;
}

/** Center of a rectangle object, or the point itself. */
export function objectCenter(obj: TiledObject): { x: number; y: number } {
  return { x: (obj.x ?? 0) + (obj.width ?? 0) / 2, y: (obj.y ?? 0) + (obj.height ?? 0) / 2 };
}

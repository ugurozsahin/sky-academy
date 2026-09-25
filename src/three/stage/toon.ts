/**
 * Cel shading (decision record 010, item 2): every object's material is a `MeshToonMaterial` over one shared
 * gradient map, built here and nowhere else — the objects tree constructs no material of its own (a rail).
 * `TONES` is provisional until the style probe (#717) picks two or three from rendered variants.
 */
import { Color, DataTexture, MeshToonMaterial, NearestFilter, RedFormat, type ColorRepresentation } from 'three';

/** Tone steps in the gradient map. Provisional (#717). */
export const TONES = 3;

const maps = new Map<number, DataTexture>();
/**
 * A `steps`-wide one-row texture whose texels climb from dark to light in equal jumps — the shape three.js's
 * own toon example uses. `NearestFilter` on both axes is what makes the steps steps rather than a ramp.
 * Cached per step count: one map serves every material on the stage.
 */
export function gradientMap(steps = TONES): DataTexture {
  const hit = maps.get(steps); if (hit) return hit;
  if (!Number.isInteger(steps) || steps < 2) throw new Error(`a gradient map needs at least two steps, got ${steps}`);
  const texels = new Uint8Array(steps);
  for (let i = 0; i < steps; i++) texels[i] = Math.round((i / (steps - 1)) * 255);
  const map = new DataTexture(texels, steps, 1, RedFormat);
  map.minFilter = NearestFilter; map.magFilter = NearestFilter;
  map.generateMipmaps = false;
  map.needsUpdate = true;
  maps.set(steps, map);
  return map;
}

/** A flat, saturated toon material in `colour`. No roughness, metalness or environment map exists on it to set. */
export function toonMaterial(colour: ColorRepresentation, steps = TONES): MeshToonMaterial {
  return new MeshToonMaterial({ color: new Color(colour), gradientMap: gradientMap(steps) });
}

/** How a token is read: `--ink` → its computed value on `:root`. Injected so Node can hand the stage a table. */
export type TokenReader = (name: string) => string;
export const cssTokens: TokenReader = (name) =>
  typeof getComputedStyle === 'function' ? getComputedStyle(document.documentElement).getPropertyValue(name).trim() : '';

/**
 * A design-language token as a colour. A token that resolves to nothing — a test without a stylesheet, a
 * misspelt name — throws rather than silently painting white: one white object beside the avatars is exactly
 * the mismatch the decision record exists to stop.
 */
export function tokenColour(name: `--${string}`, read: TokenReader = cssTokens): Color {
  const v = read(name).trim();
  if (!v) throw new Error(`design-language token ${name} resolved to nothing`);
  return new Color(v);
}

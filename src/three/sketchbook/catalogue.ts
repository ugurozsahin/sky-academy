/**
 * What the sketchbook can show: every registered object (`../objects`) behind one placeholder, so the page
 * renders the stage on a fresh checkout with no object approved yet (#715 acceptance). `default` is the
 * variant made of a schema's `n()` defaults; the others are the object's own full parameter sets.
 */
import { defaultsOf, OBJECTS, type NumParam, type ObjectSpec, type Params } from '../objects';
import { placeholder } from './placeholder';

export const DEFAULT_VARIANT = 'default';
/** `ObjectSpec<{size, radius}>` fits `readonly ObjectSpec[]` through `build`'s method-parameter bivariance, so
 *  once here a missing key is a runtime `undefined`, not a compile error: `paramsFor` being the one source of a
 *  model's params, and `defineObject`/`n()` at the object's own definition, are where the full-set rule holds. */
export const CATALOGUE: readonly ObjectSpec[] = [placeholder, ...OBJECTS];

export const variantsOf = (o: ObjectSpec): string[] => [DEFAULT_VARIANT, ...Object.keys(o.variants)];
/** A fresh copy every time — the sliders mutate what they are handed. Generic, so a typed spec keeps its schema. */
export const paramsFor = <S extends Record<string, NumParam>>(o: ObjectSpec<S>, variant: string): Params<S> =>
  variant === DEFAULT_VARIANT ? defaultsOf(o.params) : { ...(o.variants[variant] ?? defaultsOf(o.params)) };
/** The named object, or the first — a stale `?object=` in a bookmark still shows something. */
export const find = (name: string | null): ObjectSpec => CATALOGUE.find(o => o.name === name) ?? CATALOGUE[0];
/** Where an avatar's art lives, by the roster's own convention (`src/avatars.ts`: `public/avatars/<id>.webp`). */
export const avatarSrc = (id: string) => `/avatars/${id}.webp`;

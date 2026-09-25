/**
 * The objects registry (`.claude/rules/three.md`, `.claude/skills/three-art/SKILL.md` §1): one object per
 * file under `<feature>/<object>.ts`, registered here once. Empty until the first object lands through the
 * sketchbook (#684 solids, #685 islands) — the shape below is what those build to, and the budget rail in
 * `tests/unit/guardrails.test.ts` builds every entry on a headless stage at the `high` tier and holds it
 * under its declared budget.
 */
import type { Object3D } from 'three';
import type { Measure, Stage } from '../stage';

/** A numeric parameter: its default and the range the sketchbook's controls offer. */
export interface NumParam { readonly default: number; readonly min: number; readonly max: number }
export const n = (def: number, min: number, max: number): NumParam => {
  if (!(min <= def && def <= max)) throw new Error(`n(${def}, ${min}, ${max}): the default must sit inside the range`);
  return { default: def, min, max };
};
/** The values `build` receives: every key of the schema, as a number. */
export type Params<S extends Record<string, NumParam>> = { [K in keyof S]: number };

export interface ObjectSpec<S extends Record<string, NumParam> = Record<string, NumParam>> {
  /** The sketchbook's list entry and the screenshot folder. */
  readonly name: string;
  /** The 2-D avatar it belongs to (`src/avatars.ts` id); the sketchbook shows it alongside. */
  readonly avatar: string;
  readonly params: S;
  /** Full parameter sets the gallery renders — never a partial one. */
  readonly variants: Readonly<Record<string, Params<S>>>;
  /** Declared honestly; the rail measures the built mesh against it at the `high` tier. */
  readonly budget: Measure;
  /** Pure: three.js only, materials from `stage`, no DOM, no game. */
  build(p: Params<S>, stage: Stage): Object3D;
}

/**
 * The way to write an object: `S` is inferred from `params`, so a partial or misspelt variant is a compile
 * error — where `const x: ObjectSpec = {…}` would widen `S` to `Record<string, NumParam>` and let it through.
 */
export const defineObject = <S extends Record<string, NumParam>>(spec: ObjectSpec<S>): ObjectSpec<S> => spec;

/** The defaults of a schema as a full parameter set. */
export const defaultsOf = <S extends Record<string, NumParam>>(schema: S): Params<S> =>
  Object.fromEntries(Object.entries(schema).map(([k, v]) => [k, v.default])) as Params<S>;

/** Ceilings an object may not declare past without the issue saying why (`three-art` §3). */
export const BUDGET_CEILING: Measure = { triangles: 2000, drawCalls: 8 };

/** Every object the game or the sketchbook can build. Registered once, here. */
export const OBJECTS: readonly ObjectSpec[] = [];

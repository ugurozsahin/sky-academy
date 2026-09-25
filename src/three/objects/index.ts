/**
 * The objects registry (`.claude/rules/three.md`, `.claude/skills/three-art/SKILL.md` §1): one object per
 * file under `<feature>/<object>.ts`, registered here once. The contract every object builds to is `./define.ts`, re-exported here; the budget
 * rail in `tests/unit/guardrails.test.ts` builds every entry on a headless stage at the `high` tier and holds
 * it under its declared budget.
 */
import { hammer } from './probe/hammer';
import { cone } from './solids/cone';
import { cube } from './solids/cube';
import { cuboid } from './solids/cuboid';
import { cylinder } from './solids/cylinder';
import { pyramid } from './solids/pyramid';
import { sphere } from './solids/sphere';
import type { ObjectSpec } from './define';

export * from './define';

/** Every object the game or the sketchbook can build. Registered once, here. */
export const OBJECTS: readonly ObjectSpec[] = [
  hammer,   // #717: the style probe, now the sketchbook's reference piece
  cube, cuboid, sphere, cylinder, cone, pyramid,   // #684: the 3-D Shapes solids, in `SHAPES_3D`'s own terms
];

// y2-objects3d (#997): everyday objects matched to the 3-D shape they are. None of the pictures is a SHAPES_3D glyph
// (y2-shapes already draws those), and a solid is only ever the answer if the bank holds at least two objects for it.
import type { Difficulty, Generator, Question, Rng } from './types';
import { pick, shuffle, wordQ, SAME_SOLID, sameShape } from './util';

/** [picture, "a/an name", solid]. An object that is only roughly a solid (a carrot is not a cone) stays out. */
export const OBJECTS_3D: readonly (readonly [string, string, string])[] = [
  ['🍊', 'an orange', 'sphere'], ['🌍', 'a globe', 'sphere'], ['🏀', 'a basketball', 'sphere'],
  ['🥁', 'a drum', 'cylinder'], ['🔋', 'a battery', 'cylinder'],
  ['📦', 'a box', 'cuboid'], ['🎁', 'a present', 'cuboid'],
  ['🧊', 'an ice cube', 'cube'],
];
/** Solids a card may be about: two or more faithful objects. */
export const ANSWER_SOLIDS: readonly string[] = [...new Set(OBJECTS_3D.map(o => o[2]))].filter(s => OBJECTS_3D.filter(o => o[2] === s).length >= 2);
/** Names that can only ever be a wrong answer: the cube (one object) and the solids with none. */
const NAME_POOL = ['sphere', 'cylinder', 'cuboid', 'cube', 'cone', 'pyramid'];

/** Up to `n` of `pool`, none the same as `answer`, and never both halves of the cube/cuboid pair (a cube is a cuboid). */
function distinctFrom<T>(rng: Rng, pool: readonly T[], solidOf: (x: T) => string, answer: string, n: number): T[] {
  const out: T[] = [];
  for (const x of shuffle(rng, pool)) {
    const s = solidOf(x);
    if (sameShape(s, answer)) continue;
    if (SAME_SOLID.has(s) && out.some(o => SAME_SOLID.has(solidOf(o)) && solidOf(o) !== s)) continue;
    out.push(x);
    if (out.length === n) break;
  }
  return out;
}

const nameCard = (rng: Rng, d: Difficulty): Question => {
  const pool = d === 1 ? OBJECTS_3D.filter(o => ['sphere', 'cylinder', 'cuboid'].includes(o[2])) : OBJECTS_3D.filter(o => ANSWER_SOLIDS.includes(o[2]));
  const [emoji, label, solid] = pick(rng, pool);
  const names = d === 1 ? NAME_POOL.slice(0, 5) : NAME_POOL;
  const ds = distinctFrom(rng, names, s => s, solid, 3);
  return wordQ(rng, `What shape is ${label}?`, solid, ds, { visual: { type: 'word', text: emoji }, say: `What shape is ${label}?` });
};

const objectCard = (rng: Rng): Question => {
  const solid = pick(rng, ANSWER_SOLIDS);
  const [emoji] = pick(rng, OBJECTS_3D.filter(o => o[2] === solid));
  const ds = distinctFrom(rng, OBJECTS_3D, o => o[2], solid, 3).map(o => o[0]);
  return wordQ(rng, `Which one is a ${solid}?`, emoji, ds, { say: `Which one is a ${solid}?`, hint: 'Slice the object with that shape', hintIsData: false });
};

export const y2Objects3d: Generator = (d: Difficulty, rng: Rng): Question => {
  if (d === 1) return nameCard(rng, d);
  if (d === 2) return objectCard(rng);
  return rng() < 0.5 ? nameCard(rng, d) : objectCard(rng);
};

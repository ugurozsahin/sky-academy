// y2-faces (#998): the 2-D shape of a face of a 3-D shape (a circle on a cylinder, a triangle on a pyramid).
// Glyphs always come from SHAPES_2D / SHAPES_3D by reference (the #35 rail keeps them out of every other file).
import type { Difficulty, Generator, Question, Rng } from './types';
import { pick, shuffle, wordQ, numQ, SHAPES_2D, SHAPES_3D } from './util';

/** The flat faces each solid has. A square is a rectangle, so every set holding one holds the other. */
export const FACE_SETS: Readonly<Record<string, readonly string[]>> = {
  cube: ['square', 'rectangle'],
  cuboid: ['rectangle', 'square'],
  cylinder: ['circle'],
  cone: ['circle'],
  pyramid: ['triangle', 'square', 'rectangle'],
  sphere: [],
};
/** Solids a naming card may be about: the sphere has no flat face, so it is only ever a decoy. */
export const FACE_SOLIDS: readonly string[] = ['cube', 'cuboid', 'cylinder', 'cone', 'pyramid'];
/** The faces a card names for each solid, so a cube never answers ▬ and a cuboid never answers ■. */
const SHOWN_FACE: Readonly<Record<string, readonly string[]>> = { cube: ['square'], cuboid: ['rectangle'], cylinder: ['circle'], cone: ['circle'], pyramid: ['triangle', 'square'] };
/** Who answers a reverse card: a rectangle face is always the cuboid. */
const ANSWERS: Readonly<Record<string, readonly string[]>> = { triangle: ['pyramid'], square: ['cube', 'pyramid'], rectangle: ['cuboid'], circle: ['cylinder', 'cone'] };
/** Faces a reverse card may ask for. */
export const ASKED_FACES: readonly string[] = ['triangle', 'square', 'rectangle', 'circle'];

const glyph2 = (name: string): string => SHAPES_2D.find(s => s[1] === name)![0];
const solid = (name: string) => SHAPES_3D.find(s => s[1] === name)!;
const asName = (name: string): string => solid(name)[2].as;
const has = (s: string, face: string): boolean => FACE_SETS[s].includes(face);

/** Up to `n` of `pool` the relation fails for, never both halves of the square/rectangle or cube/cuboid pairs. */
function decoys(rng: Rng, pool: readonly string[], n: number, pair: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const x of shuffle(rng, pool)) {
    if (pair.has(x) && out.some(o => pair.has(o))) continue;
    out.push(x);
    if (out.length === n) break;
  }
  return out;
}
const FLAT_PAIR = new Set(['square', 'rectangle']), SOLID_PAIR = new Set(['cube', 'cuboid']);

/** Solid → face: "Which shape is on a cylinder?" */
const faceCard = (rng: Rng): Question => {
  const s = pick(rng, FACE_SOLIDS);
  const face = pick(rng, SHOWN_FACE[s]);
  const wrong = SHAPES_2D.map(x => x[1]).filter(f => !has(s, f));
  const ds = decoys(rng, wrong, 3, FLAT_PAIR).map(glyph2);
  const prompt = `Which flat shape is on a ${asName(s)}?`;
  return wordQ(rng, prompt, glyph2(face), ds, { visual: { type: 'word', text: solid(s)[0] }, say: prompt, hint: 'Look at one flat face', hintIsData: false });
};

/** Face → solid: "Which 3-D shape has a triangle face?" */
const solidCard = (rng: Rng): Question => {
  const face = pick(rng, ASKED_FACES);
  const right = pick(rng, ANSWERS[face]);
  const wrong = SHAPES_3D.map(s => s[1]).filter(s => !has(s, face));
  const ds = decoys(rng, wrong, 3, SOLID_PAIR).map(n => solid(n)[0]);
  const prompt = `Which 3-D shape has a ${face} face?`;
  return wordQ(rng, prompt, solid(right)[0], ds, { say: prompt, hint: 'Slice the 3-D shape', hintIsData: false });
};

/** Sides of a named face: cube and cuboid faces have 4, a triangle face of the pyramid has 3. */
const sidesCard = (rng: Rng): Question => {
  const [s, face] = pick(rng, [['cube', 'square'], ['cuboid', 'rectangle'], ['pyramid', 'triangle'], ['pyramid', 'square']] as const);
  const sides = SHAPES_2D.find(x => x[1] === face)![2];
  const prompt = `How many sides has a ${face} face of a ${asName(s)}?`;
  return numQ(rng, prompt, sides, { min: 0, max: 8, say: prompt, visual: { type: 'word', text: solid(s)[0] } });
};

export const y2Faces: Generator = (d: Difficulty, rng: Rng): Question => {
  if (d === 1) return faceCard(rng);
  if (d === 2) return rng() < 0.5 ? faceCard(rng) : solidCard(rng);
  const r = rng();
  return r < 0.34 ? faceCard(rng) : r < 0.67 ? solidCard(rng) : sidesCard(rng);
};

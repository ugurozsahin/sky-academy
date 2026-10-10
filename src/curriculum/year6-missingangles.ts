// y6-missingangles (#1247): missing angles in shapes, on lines and vertically opposite (NC 6M43, 6M45). d1 is drawn with the
// `geometry` parts, every arc's sweep exactly its value: two crossing lines (the opposite angle is equal, an adjacent one is
// 180 minus it) or three angles at a point (360). d2 is text: a missing angle of a triangle (180), an isosceles triangle's
// base angle, or a quadrilateral's fourth (360). d3 is text: each angle of a regular polygon, the angle sum of a polygon
// ((n − 2) × 180), or a pentagon's fifth angle. Drawn angles are multiples of 5°; the named slip is always the first decoy.
import type { Difficulty, GeoPart, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ } from './util';

/** A label such as `135°`; four digits take a comma (`1,080°`, #1047). */
const deg = (v: number) => `${String(v).replace(/\B(?=(\d{3})+$)/g, ',')}°`;
const STEPS = [10, -10, 20, -20, 5, -5, 15, -15, 30, -30, 40, -40, 50, -50];
const lastOf = (v: number) => v % 10;
const leadOf = (v: number) => String(v)[0];

/**
 * Four options. The named slips come first and the first is never displaced; for an answer of 20 or more a decoy sharing
 * its last digit and one sharing its leading digit are filled in with ±5…±50 steps (#1058), so a drawn card stays on 5°.
 * `max` bounds the options: 360 for an angle, 1500 for an angle sum.
 */
export function degCard(rng: Rng, prompt: string, answer: number, named: number[], extra: Partial<Question>, max = 360): Question {
  const ok = (v: number) => Number.isInteger(v) && v > 0 && v < max && v !== answer;
  const ds = [...new Set(named.filter(ok))].slice(0, 3);
  const fills = () => STEPS.map(s => answer + s).filter(v => ok(v) && !ds.includes(v));
  const props = [(v: number) => lastOf(v) === lastOf(answer), (v: number) => leadOf(v) === leadOf(answer)];
  if (answer >= 20) {
    for (const prop of props) {
      if (ds.some(prop)) continue;
      const others = props.filter(o => o !== prop);
      for (const c of shuffle(rng, fills().filter(prop))) {
        const next = ds.length < 3 ? [[...ds, c]] : [2, 1].map(i => ds.map((v, j) => (j === i ? c : v)));
        const hit = next.find(a => others.every(o => !ds.some(o) || a.some(o)));
        if (hit) { ds.splice(0, ds.length, ...hit); break; }
      }
    }
  }
  for (const c of fills()) if (ds.length < 3) ds.push(c);
  return wordQ(rng, prompt, deg(answer), ds.slice(0, 3).map(deg), { hint: 'Think about the total: a straight line, a whole turn, a triangle', hintIsData: false, ...extra });
}

/** d1: crossing lines (vertically opposite or on a line), or three angles at a point. */
function crossCard(rng: Rng, opposite: boolean): Question {
  let k = 5 * ri(rng, 8, 28);
  while (k >= 85 && k <= 95) k = 5 * ri(rng, 8, 28);
  // The picture is a function of the prompt (the known angle and the kind of card), so two cards that read alike never draw differently.
  const n5 = k / 5, known = n5 % 2, a = known === 0 ? k : 180 - k, theta = 15 * ((n5 * 5 + (opposite ? 0 : 7)) % 24), c: [number, number] = [50, 35], L = 27;
  const end = (dir: number, sign: 1 | -1): [number, number] => [Math.round((c[0] + sign * L * Math.cos(dir * Math.PI / 180)) * 100) / 100, Math.round((c[1] - sign * L * Math.sin(dir * Math.PI / 180)) * 100) / 100];
  const arcs = [[theta, a], [theta + a, 180 - a], [theta + 180, a], [theta + 180 + a, 180 - a]].map(([d0, v]) => ({ dir: d0 % 360, deg: v }));
  const unk = opposite ? known + 2 : (known + ((n5 >> 1) % 2 ? 1 : 3)) % 4, answer = opposite ? k : 180 - k;
  const part = (i: number, label: string): GeoPart => ({ kind: 'angle', at: c, dir: arcs[i].dir, deg: arcs[i].deg, label, len: 13 });
  const parts: GeoPart[] = [
    { kind: 'segment', a: end(theta, 1), b: end(theta, -1) }, { kind: 'segment', a: end(theta + a, 1), b: end(theta + a, -1) },
    part(known, deg(k)), part(unk, '?'),
  ];
  return degCard(rng, opposite ? `Two lines cross: one angle is ${deg(k)}. Opposite = ?°` : `Angles on a straight line: ${deg(k)} and ?°`, answer, opposite ? [180 - k, 90, 360 - k] : [k, 90, 360 - k], {
    visual: { type: 'geometry', parts },
    say: opposite ? 'Two straight lines cross. Angles opposite each other are equal. What is the missing angle?' : 'Two straight lines cross. Angles next to each other on a straight line add up to 180 degrees. What is the missing angle?',
    hint: opposite ? 'Angles opposite each other at a crossing are equal' : 'Angles on a straight line make a half turn',
  });
}

function pointCard(rng: Rng): Question {
  let x: number, y: number, z: number;
  do { x = 5 * ri(rng, 6, 20); y = 5 * ri(rng, 6, 20); z = 360 - x - y; } while (z < 30 || z % 5 !== 0);
  const answer = pick(rng, [x, y, z]), knownSizes = [x, y, z].filter((_, i, all) => i !== all.indexOf(answer)).sort((p, q) => p - q), sum = 360 - answer;
  // Placement is a function of the numbers on the card, so two cards that read alike never draw differently.
  const order = [...knownSizes]; order.splice((answer / 5) % 3, 0, answer);
  let dir = 15 * ((answer / 5 + knownSizes[0] / 5) % 24), seen = false;
  const parts: GeoPart[] = order.map(v => {
    const isUnk = v === answer && !seen && (seen = true);
    const p: GeoPart = { kind: 'angle', at: [50, 38], dir: dir % 360, deg: v, label: isUnk ? '?' : deg(v), len: 15 }; dir += v; return p;
  });
  return degCard(rng, `Angles at a point: ${knownSizes.map(deg).join(', ')} and ?°`, answer, [Math.abs(180 - sum), sum, 90 + answer], {
    visual: { type: 'geometry', parts }, say: 'Angles at a point add up to 360 degrees. What is the missing angle?', hint: 'Angles at a point make a whole turn',
  });
}

function drawn(rng: Rng): Question {
  const r = rng();
  return r < 0.34 ? crossCard(rng, true) : r < 0.67 ? crossCard(rng, false) : pointCard(rng);
}

/** d2: triangles and quadrilaterals in text. */
function shapeCard(rng: Rng): Question {
  const r = rng();
  if (r < 0.4) {
    const a = ri(rng, 20, 100), b = ri(rng, 20, 150 - a), s = a + b;
    return degCard(rng, `Triangle: angles ${a}° and ${b}°. Third angle = ?°`, 180 - s, [360 - s, s, 90], {
      say: `A triangle has angles of ${a} degrees and ${b} degrees. What is the third angle? The angles of a triangle add up to 180 degrees.`, hint: 'The angles of a triangle make a half turn' });
  }
  if (r < 0.7) {
    const t = 2 * ri(rng, 10, 70);
    return degCard(rng, `Isosceles triangle: top angle ${t}°. Each base angle = ?°`, (180 - t) / 2, [180 - t, t, 360 - t], {
      say: `An isosceles triangle has a top angle of ${t} degrees. What is each base angle? The two base angles are equal.`, hint: 'Take the top angle from the triangle total, then share the rest between the two equal base angles' });
  }
  for (;;) {
    const a = ri(rng, 60, 130), b = ri(rng, 60, 130), c = ri(rng, 60, 130), s = a + b + c, d = 360 - s;
    if (d < 40 || d > 150 || s === 270) continue;
    return degCard(rng, `Quadrilateral: angles ${a}°, ${b}° and ${c}°. Fourth = ?°`, d, [s - 180, s, 180 - d], {
      say: `A quadrilateral has angles of ${a}, ${b} and ${c} degrees. What is the fourth angle? The angles of a quadrilateral add up to 360 degrees.`, hint: 'The angles of a quadrilateral make a whole turn' });
  }
}

/** d3: regular and irregular polygons in text. */
const NAMES: Record<number, string> = { 5: 'pentagon', 6: 'hexagon', 7: 'heptagon', 8: 'octagon', 9: 'nonagon', 10: 'decagon', 12: 'dodecagon' };
function polygonCard(rng: Rng): Question {
  const r = rng();
  if (r < 0.4) {
    const n = pick(rng, [5, 6, 8, 9, 10, 12]), each = 180 * (n - 2) / n;
    return degCard(rng, `Each angle of a regular ${NAMES[n]} = ?°`, each, [360 / n, 180 * (n - 2), 180 - each + 90], {
      say: `What is each angle of a regular ${NAMES[n]}? Add up the angles inside, then share them between the equal angles.`, hint: 'Add up the angles inside, then share them equally' });
  }
  if (r < 0.6) {
    const n = pick(rng, [5, 6, 7, 8]);
    return degCard(rng, `The angles in a ${NAMES[n]} add up to ?°`, 180 * (n - 2), [180 * n, 180 * (n - 1), 180 * (n - 3)], {
      say: `The angles inside a ${NAMES[n]} add up to how many degrees? Split it into triangles.`, hint: 'Sides take away two gives the triangles; each is a half turn' }, 1500);
  }
  for (;;) {
    const k = Array.from({ length: 4 }, () => 5 * ri(rng, 16, 30)), s = k.reduce((x, y) => x + y, 0), f = 540 - s;
    if (f < 60 || f > 160) continue;
    return degCard(rng, `Pentagon: angles ${k[0]}°, ${k[1]}°, ${k[2]}° and ${k[3]}°. Fifth = ?°`, f, [s - 360, 360 - f, 180 - f], {
      say: `A pentagon has four angles of ${k[0]}, ${k[1]}, ${k[2]} and ${k[3]} degrees. What is the fifth angle? The angles of a pentagon add up to 540 degrees.`, hint: 'Take the four angles from the pentagon total' });
  }
}

export const y6MissingAngles: Generator = (d: Difficulty, rng: Rng): Question => (d === 1 ? drawn : d === 2 ? shapeCard : polygonCard)(rng);

import { describe, it, expect } from 'vitest';
import { topicById, type Difficulty, type Visual } from '../../src/curriculum';
import { coordsAnswer, fmt } from '../../src/curriculum/year4-coords';
import { repeatKey } from '../../src/game/session';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const t = topicById('y4-coords')!;
type Coords = Extract<Visual, { type: 'coords' }>;
const vis = (q: ReturnType<typeof t.gen>) => q.visual as Coords;
const parse = (s: string) => { const m = s.match(/^\((\d+), (\d+)\)$/)!; return { x: +m[1], y: +m[2] }; };

const onGrid = (p: { x: number; y: number }, size: number) => p.x >= 0 && p.y >= 0 && p.x <= size && p.y <= size;
type Q = ReturnType<typeof t.gen>;
const moveOf = (m: RegExpMatchArray) => ({ dx: m[1] ? (m[2] === 'right' ? +m[1] : -+m[1]) : 0, dy: m[3] ? (m[4] === 'up' ? +m[3] : -+m[3]) : 0 });
const MOVE = /^A moves (?:(\d+) (right|left))?(?: and )?(?:(\d+) (up|down))?\. Where does it land\?$/;

function checkGrid(q: Q, v: Coords) {
  for (const p of v.points) expect(onGrid(p, v.size), `${q.prompt} ${p.label} on the grid`).toBe(true);
  expect(new Set(v.points.map(p => `${p.x},${p.y}`)).size, 'no two points share a place').toBe(v.points.length);
  expect(new Set(v.points.map(p => p.label)).size).toBe(v.points.length);
}
function checkRead(q: Q, v: Coords, label: string) {
  expect(q.answer).toBe(coordsAnswer.read(v.points, label));
  expect(q.options).toHaveLength(4);
}
function checkAt(q: Q, v: Coords, pair: string) {
  expect(q.answer).toBe(coordsAnswer.at(v.points, parse(pair)));
  expect(q.answer).toHaveLength(1);
  expect(q.options.slice().sort()).toEqual(v.points.map(p => p.label).sort());
}
function checkMove(q: Q, v: Coords, m: RegExpMatchArray) {
  const { dx, dy } = moveOf(m);
  expect(dx !== 0 || dy !== 0).toBe(true);
  expect(q.answer).toBe(coordsAnswer.move(v.points[0], dx, dy));
  for (const o of q.options) expect(onGrid(parse(o), v.size), `option ${o} on the grid`).toBe(true);
}
function checkCorner(q: Q, v: Coords) {
  expect(q.prompt).toMatch(/^Which point completes the (rectangle|square)\?$/);
  const [a, b, c] = v.points, want = coordsAnswer.corner(a, b, c);
  const fits = v.points.slice(3).filter(p => p.x === want.x && p.y === want.y);
  expect(fits, 'exactly one candidate completes it').toHaveLength(1);
  expect(q.answer).toBe(fits[0].label);
  expect(b.x === a.x && b.y === c.y, 'B sits between A and C at a right angle').toBe(true);
  expect(v.join).toEqual(['A', 'B', 'C']);
  expect(q.options).toEqual(['D', 'E', 'F']);
}
function checkAnswer(d: Difficulty, q: Q, v: Coords) {
  const read = q.prompt.match(/^What are the coordinates of ([A-D])\?$/), at = q.prompt.match(/^Which point is at (\(\d+, \d+\))\?$/), move = q.prompt.match(MOVE);
  expect(d).toBe(read || at ? 1 : move ? 2 : 3);
  if (read) checkRead(q, v, read[1]);
  else if (at) checkAt(q, v, at[1]);
  else if (move) checkMove(q, v, move);
  else checkCorner(q, v);
}

describe('y4-coords (#1129)', () => {
  it('is a Year 4 maths geometry topic called Coordinates', () => {
    expect(t).toMatchObject({ year: 'year4', subject: 'maths', title: 'Coordinates', strand: 'geometry' });
  });

  for (const d of [1, 2, 3] as Difficulty[]) {
    it(`d${d}: over 2,000 draws the answer equals the value computed from the points, with one true option and no duplicates`, () => {
      const r = rng(1129 + d);
      for (let i = 0; i < 2000; i++) {
        const q = t.gen(d, r), v = vis(q);
        expect(v.type).toBe('coords');
        expect(new Set(q.options).size, q.prompt).toBe(q.options.length);
        expect(q.options.filter(o => o === q.answer)).toHaveLength(1);
        checkGrid(q, v);
        checkAnswer(d, q, v);
      }
    });
  }

  it('d1 and d2 decoys include the named slips: the swapped pair, off by one, and (d2) the wrong direction', () => {
    const r = rng(7);
    let swapped = 0, near = 0, wrongWay = 0, read = 0, move = 0;
    for (let i = 0; i < 1500; i++) {
      const q = t.gen(1, r);
      const m = q.prompt.match(/^What are the coordinates of ([A-D])\?$/);
      if (m) {
        read++;
        const p = vis(q).points.find(x => x.label === m[1])!;
        if (p.x !== p.y && q.options.includes(fmt({ x: p.y, y: p.x }))) swapped++;
        if ([[1, 0], [0, 1], [-1, 0], [0, -1]].some(([dx, dy]) => q.options.includes(fmt({ x: p.x + dx, y: p.y + dy })))) near++;
      }
      const q2 = t.gen(2, r), { dx, dy } = moveOf(q2.prompt.match(MOVE)!);
      move++;
      const a = vis(q2).points[0];
      if (q2.options.includes(fmt({ x: a.x - dx, y: a.y + dy })) || q2.options.includes(fmt({ x: a.x + dx, y: a.y - dy }))) wrongWay++;
    }
    expect(swapped / read).toBeGreaterThan(0.5);
    expect(near / read).toBeGreaterThan(0.8);
    expect(wrongWay / move).toBeGreaterThan(0.5);
  });

  it('d3 offers the parallelogram corner from the wrong diagonal when it lies on the grid', () => {
    const r = rng(9);
    let seen = 0;
    for (let i = 0; i < 1000; i++) {
      const v = vis(t.gen(3, r)), [a, b, c] = v.points, wrong = { x: a.x + b.x - c.x, y: a.y + b.y - c.y };
      if (v.points.slice(3).some(p => p.x === wrong.x && p.y === wrong.y)) seen++;
    }
    expect(seen).toBeGreaterThan(50);
  });

  it('the options are coordinate pairs or letters, never a bare number, so the #1058 digit-leak limit (whole numbers ≥ 20, money, decimals) does not apply', () => {
    const r = rng(44);
    for (const d of [1, 2, 3] as Difficulty[]) for (let i = 0; i < 300; i++) for (const o of t.gen(d, r).options) expect(o).toMatch(/^(\(\d+, \d+\)|[A-F])$/);
  });

  it('the spoken text reads a pair as two numbers, never one', () => {
    const r = rng(3);
    let pairs = 0;
    for (let i = 0; i < 400; i++) {
      const q = t.gen(1, r);
      if (!/\(\d+, \d+\)/.test(q.prompt)) continue;
      pairs++;
      expect(q.say).toMatch(/^Which point is at \d+, \d+\?$/);
      expect(q.say).not.toMatch(/\(|\)/);
    }
    expect(pairs).toBeGreaterThan(50);
  });

  it('the repeat key reads where the points are, not their letters', () => {
    const q = t.gen(2, rng(1));
    const moved = { ...q, visual: { ...vis(q), points: vis(q).points.map(p => ({ ...p, x: p.x + 1 })) } as Visual };
    const relabelled = { ...q, visual: { ...vis(q), points: vis(q).points.map(p => ({ ...p, label: 'Z' })) } as Visual };
    expect(repeatKey(moved)).not.toBe(repeatKey(q));
    expect(repeatKey(relabelled)).toBe(repeatKey(q));
  });
});

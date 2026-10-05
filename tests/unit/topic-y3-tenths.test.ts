import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { parseNum } from '../../src/curriculum/ks2num';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y3-tenths')!;
const DRAWS = 400;
const draws = (d: Difficulty) => { const r = rng(1091 + d); return Array.from({ length: DRAWS }, () => topic.gen(d, r)); };
/** A label's value in integer tenths: "4/10" → 4, "0.7" → 7, "1" → 10; null for anything else. */
function tenths(label: string): number | null {
  const f = label.match(/^(\d+)\/10$/);
  if (f) return Number(f[1]);
  const n = parseNum(label);
  return n && n.dp <= 1 && /^\d+(\.\d)?$/.test(label) ? n.v * 10 ** (1 - n.dp) : null;
}
/** Independent oracle: the answer in tenths, read from the card alone. */
function oracle(c: Question): number {
  const v = c.visual;
  if (v?.type === 'numberline') { const i = v.labels!.indexOf('?'); return Math.round(v.from * 10) + i; }
  let m = c.prompt.match(/^What is one tenth (more|less) than ([\d.]+)\?$/);
  if (m) return tenths(m[2])! + (m[1] === 'more' ? 1 : -1);
  m = c.prompt.match(/^(\d) ÷ 10 = \? \(as a (fraction|decimal)\)$/);
  if (m) return Number(m[1]);
  m = c.prompt.match(/^How many tenths make (\d)\?$/);
  expect(m, c.prompt).toBeTruthy();
  return NaN; // answer is a count of tenths, checked by the caller
}

describe('y3-tenths (#1091)', () => {
  it('is registered once, in Year 3', () => {
    expect(TOPICS.filter(t => t.id === 'y3-tenths')).toHaveLength(1);
    expect(topic.year).toBe('year3');
  });

  it('every answer matches the oracle in integer tenths, sits once among four options of different value', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) {
      const want = oracle(c), m = c.prompt.match(/^How many tenths make (\d)\?$/);
      if (m) expect(Number(c.answer), c.prompt).toBe(10 * Number(m[1]));
      else expect(tenths(c.answer), c.prompt).toBe(want);
      expect(c.options.filter(o => o === c.answer), c.prompt).toHaveLength(1);
      expect(c.options, c.prompt).toHaveLength(4);
      expect(new Set(c.options).size, c.prompt).toBe(4);
      const asTenths = c.options.map(o => (m ? Number(o) : tenths(o) ?? o)); // "0.10" is the deliberate misread, never a value of its own
      expect(new Set(asTenths).size, `${c.prompt} ${c.options}`).toBe(4);
    }
  });

  it('no option or tick label is negative', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) for (const o of [c.answer, ...c.options]) expect(o, c.prompt).not.toMatch(/^[−-]/);
  });

  it('no label shows a float artefact, and every line has at most six ticks', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) {
      for (const s of [c.answer, ...c.options, ...(c.visual?.type === 'numberline' ? c.visual.labels! : [])]) expect(s, c.prompt).not.toMatch(/\d\.\d{2,}(?<!\.10)$|e[+-]/);
      if (c.visual?.type === 'numberline') { expect(c.visual.labels!.length, c.prompt).toBeLessThanOrEqual(6); expect(c.visual.step).toBe(0.1); }
    }
  });

  it('d1 is fractions only, d2 decimals only, and a line hides one tick that is also the mark', () => {
    for (const c of draws(1)) {
      expect(c.visual?.type, c.prompt).toBe('numberline');
      for (const o of c.options) expect(o, c.prompt).toMatch(/^\d+\/\d+$/);
    }
    for (const c of draws(2)) for (const o of c.options) expect(o, c.prompt).not.toContain('/');
    for (const d of [1, 2] as Difficulty[]) for (const c of draws(d)) {
      if (c.visual?.type !== 'numberline') continue;
      expect(c.visual.labels!.filter(l => l === '?'), c.prompt).toHaveLength(1);
      expect(c.visual.mark, c.prompt).toBeDefined();
    }
  });

  it('d2 counts across a whole and offers the "0.10" misread there; d2 also asks one tenth more and less', () => {
    const cards = draws(2);
    const cross = cards.filter(c => c.visual?.type === 'numberline' && c.answer.match(/^\d+$/));
    expect(cross.length).toBeGreaterThan(0);
    expect(cross.some(c => c.options.some(o => /\.10$/.test(o)))).toBe(true);
    expect(cards.some(c => /one tenth more/.test(c.prompt))).toBe(true);
    expect(cards.some(c => /one tenth less/.test(c.prompt))).toBe(true);
  });

  it('d3 names the notation, and offers the multiplied and unchanged slips', () => {
    const cards = draws(3).filter(c => c.prompt.includes('÷'));
    expect(cards.some(c => c.prompt.endsWith('(as a decimal)'))).toBe(true);
    expect(cards.some(c => c.prompt.endsWith('(as a fraction)'))).toBe(true);
    for (const c of cards) { const n = c.prompt[0]; expect(c.options, c.prompt).toContain(String(Number(n) * 10)); expect(c.options, c.prompt).toContain(n); }
    expect(draws(3).some(c => c.prompt.startsWith('How many tenths'))).toBe(true);
  });

  it('every card has a say with no raw fraction or symbol', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) expect(c.say, c.prompt).not.toMatch(/\d\/\d|÷/);
  });

  it('decoys leak neither the units nor the leading digit more than 30% of the time', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const s = leakShares(topic.gen, d, 2000);
      expect(s.units, `d${d}`).toBeLessThanOrEqual(0.3);
      expect(s.leading, `d${d}`).toBeLessThanOrEqual(0.3);
    }
  });
});

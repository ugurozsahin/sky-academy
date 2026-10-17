import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question, Visual } from '../../src/curriculum';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { parseFrac, simplify } from '../../src/curriculum/fractions';
import { repeatKey } from '../../src/game/repeat-key';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-pie')!;
const draw = (d: Difficulty, n = 2000) => { const r = rng(1239 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const slices = (q: Question) => (q.visual as Extract<Visual, { type: 'pie' }>).slices;

describe('y6-pie (#1239)', () => {
  it('is registered for Year 6 maths in the stats strand', () => { expect(topic).toMatchObject({ year: 'year6', subject: 'maths', strand: 'stats', title: 'Pie Charts' }); });

  it('every card has four distinct options including the answer, a pie of 2-5 labelled slices and a speakable say', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(new Set(q.options).size, q.prompt).toBe(4); expect(q.options).toContain(q.answer);
      expect(q.visual?.type).toBe('pie');
      const s = slices(q); expect(s.length).toBeGreaterThanOrEqual(2); expect(s.length).toBeLessThanOrEqual(5);
      expect(new Set(s.map(x => x.label)).size).toBe(s.length);
      s.forEach(x => { expect(x.label.length).toBeLessThanOrEqual(7); expect(x.n).toBeGreaterThan(0); });
      const total = s.reduce((a, x) => a + x.n, 0); expect(Math.min(...s.map(x => x.n)) * 12, q.prompt).toBeGreaterThanOrEqual(total);
      expect(q.prompt.length).toBeLessThanOrEqual(60); expect(sayIsSafe(q.say!), q.say).toBe(true); expect(q.say).not.toContain('/');
      expect(q.say).not.toMatch(/placeholder|coming soon|temporary/i);
    }
  });

  it('d1 oracle: the answer is the label of the largest or smallest slice, with no tie', () => {
    for (const q of draw(1)) {
      const s = slices(q), ns = s.map(x => x.n), most = q.prompt.endsWith('most?');
      expect(new Set(ns).size).toBe(ns.length);
      expect(s.find(x => x.n === (most ? Math.max(...ns) : Math.min(...ns)))!.label).toBe(q.answer);
      expect([...q.options].sort()).toEqual(s.map(x => x.label).sort());
    }
  });

  it('d2 oracle: the answer is the named slice over the total, in its simplest form, and no option equals it by value', () => {
    for (const q of draw(2)) {
      const s = slices(q), name = /chose (\w+)\?/.exec(q.prompt)![1], total = s.reduce((a, x) => a + x.n, 0);
      expect(parseFrac(q.answer)).toEqual(simplify({ n: s.find(x => x.label === name)!.n, d: total }));
      expect(q.answer).toBe(`${parseFrac(q.answer)!.n}/${parseFrac(q.answer)!.d}`);
      q.options.forEach(o => { const f = parseFrac(o)!; expect(f.n, `${q.prompt}: ${o} is a whole or more`).toBeLessThan(f.d); });
      q.options.filter(o => o !== q.answer).forEach(o => expect(parseFrac(o), `${q.answer} vs ${o}`).not.toEqual(parseFrac(q.answer)));
    }
  });

  it('d3 oracle: the answer is the named slice\'s count, which is the share of the stated total; exactly one option is true', () => {
    for (const q of draw(3)) {
      const s = slices(q), m = /^(\d+) children were asked\. How many chose (\w+)\?$/.exec(q.prompt)!, total = Number(m[1]);
      expect(s.reduce((a, x) => a + x.n, 0)).toBe(total);
      expect(Number(q.answer)).toBe(s.find(x => x.label === m[2])!.n);
      expect(q.options.filter(o => o === q.answer)).toHaveLength(1);
      expect([12, 24, 36, 40, 60, 72, 100, 120]).toContain(total);
    }
  });

  it('keeps the units-digit leak at or under 30% on d3 cards with answers of 20 or more (#1058)', () => {
    const l = leakShares(topic.gen, 3, 2000); expect(l.counted).toBeGreaterThan(100); expect(l.units).toBeLessThanOrEqual(0.3);
  });

  it('repeats are told apart by the counts, not the labels', () => {
    const a = { prompt: 'p', answer: 'a', options: ['a'], visual: { type: 'pie', slices: [{ label: 'x', n: 1 }, { label: 'y', n: 3 }] } } as Question;
    const b = { ...a, visual: { type: 'pie', slices: [{ label: 'pears', n: 1 }, { label: 'plums', n: 3 }] } } as Question;
    const c = { ...a, visual: { type: 'pie', slices: [{ label: 'x', n: 2 }, { label: 'y', n: 2 }] } } as Question;
    expect(repeatKey(a)).toBe(repeatKey(b)); expect(repeatKey(a)).not.toBe(repeatKey(c));
  });
});

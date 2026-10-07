import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { pounds, poundsSay, y4MoneyCard, compareCard } from '../../src/curriculum/year4-money';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y4-money')!;
const draw = (d: Difficulty, n: number) => { const r = rng(1149 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const pence = (s: string) => { const m = s.match(/^£(\d{1,2})\.(\d{2})$/)!; return Number(m[1]) * 100 + Number(m[2]); };
const LABEL = /£\d{1,2}\.\d{2}/g;

describe('y4-money (#1149)', () => {
  it('is registered for Year 4', () => { expect(topic.year).toBe('year4'); });

  it('pounds and poundsSay agree on five amounts', () => {
    const want: Array<[number, string, string]> = [[345, '£3.45', '3 pounds 45'], [45, '£0.45', '45 pence'], [305, '£3.05', '3 pounds 5'], [1200, '£12.00', '12 pounds'], [5, '£0.05', '5 pence']];
    for (const [p, l, s] of want) { expect(pounds(p)).toBe(l); expect(poundsSay(p)).toBe(s); }
  });

  for (const d of [1, 2, 3] as Difficulty[]) {
    it(`d${d}: every money label is £x.yy within £0.01–£99.99, options are distinct and the answer is offered`, () => {
      for (const q of draw(d, 400)) {
        expect(q.options).toContain(q.answer);
        expect(q.options.length).toBeGreaterThanOrEqual(2);
        expect(new Set(q.options).size).toBe(q.options.length);
        q.options.forEach(o => { expect(o).toMatch(/^£\d{1,2}\.\d{2}$/); expect(pence(o)).toBeGreaterThanOrEqual(1); });
        expect(q.visual).toBeUndefined();
      }
    });

    it(`d${d}: speech has no decimal point or raw fraction`, () => {
      for (const q of draw(d, 400)) { expect(q.say).toBeTruthy(); expect(sayIsSafe(q.say!)).toBe(true); expect(q.say).not.toMatch(/£|\d\.\d|\d\/\d/); }
    });
  }

  it('d1 notation: the oracle holds and the place-value shift is always offered', () => {
    let n = 0;
    for (const q of Array.from({ length: 400 }, ((r) => () => y4MoneyCard(1, r))(rng(7)))) {
      const p = Number(q.prompt.match(/^(\d+)p = \?$/)![1]);
      expect(pence(q.answer)).toBe(p);
      expect(q.options).toContain(pounds(p * 10));
      expect(q.options.length).toBe(4);
      if (p % 100 < 10) expect(q.options).toContain(pounds(Math.floor(p / 100) * 100 + (p % 100) * 10));
      n++;
    }
    expect(n).toBe(400);
  });

  it('d1 "which is more" has two bubbles and the larger amount is the answer', () => {
    const r = rng(11);
    for (let i = 0; i < 300; i++) {
      const q = compareCard(r);
      const m = q.prompt.match(/^Which is more: £(\d+\.\d{2}) or (\d+)p\?$/)!;
      const a = pence('£' + m[1]), b = Number(m[2]);
      expect(a).not.toBe(b);
      expect(q.options.length).toBe(2);
      expect(pence(q.answer)).toBe(Math.max(a, b));
    }
    expect(draw(1, 400).some(q => q.prompt.startsWith('Which is more'))).toBe(true);
  });

  it('d2: the oracle holds for add, subtract and change', () => {
    const seen = { add: 0, sub: 0, change: 0 };
    for (const q of draw(2, 600)) {
      const amts = (q.prompt.match(LABEL) ?? []).map(pence);
      if (q.prompt.includes(' + ')) { seen.add++; expect(pence(q.answer)).toBe(amts[0] + amts[1]); }
      else if (q.prompt.includes(' − ')) { seen.sub++; expect(pence(q.answer)).toBe(amts[0] - amts[1]); }
      else { seen.change++; const pay = Number(q.prompt.match(/from £(\d+)\./)![1]) * 100; expect(pence(q.answer)).toBe(pay - amts[0]); }
    }
    expect(seen.add).toBeGreaterThan(100); expect(seen.sub).toBeGreaterThan(100); expect(seen.change).toBeGreaterThan(100);
  });

  it('d3: every fraction and multiplier problem comes out in whole pence by integer arithmetic', () => {
    const seen = { off: 0, price: 0, each: 0, share: 0 };
    for (const q of draw(3, 800)) {
      const amts = (q.prompt.match(LABEL) ?? []).map(pence), a = pence(q.answer);
      const f = q.prompt.match(/(\d)\/(\d+)/);
      if (f) {
        const num = Number(f[1]), den = Number(f[2]), off = (amts[0] * num) / den;
        expect(Number.isInteger(off)).toBe(true);
        /new price|Pay\?/.test(q.prompt) ? (seen.price++, expect(a).toBe(amts[0] - off)) : (seen.off++, expect(a).toBe(off));
      } else if (q.prompt.includes('each. How much')) {
        seen.each++; const n = Number(q.prompt.match(/^(\d+) /)![1]); expect(a).toBe(amts[0] * n);
      } else {
        seen.share++; const n = Number(q.prompt.match(/by (\d+) friends/)![1]); expect(a * n).toBe(amts[0]);
      }
    }
    for (const k of Object.values(seen)) expect(k).toBeGreaterThan(50);
  });

  it('d3 offers the unit-part and amount-left slips on a non-unit fraction', () => {
    let n = 0;
    for (const q of draw(3, 800)) {
      const f = q.prompt.match(/(\d)\/(\d+)/);
      if (!f || f[1] === '1' || /new price|Pay\?/.test(q.prompt)) continue;
      const price = pence(q.prompt.match(LABEL)![0]), off = pence(q.answer);
      n++; expect(q.options.map(pence)).toContain(price - off);
    }
    expect(n).toBeGreaterThan(30);
  });

  for (const d of [1, 2, 3] as Difficulty[]) {
    it(`d${d}: over 2,000 draws at most 30% of cards have a unique last or leading digit`, () => {
      const s = leakShares((lv, r) => y4MoneyCard(lv, r), d, 2000);
      expect(s.counted).toBeGreaterThan(1500);
      expect(s.units).toBeLessThanOrEqual(0.3); expect(s.leading).toBeLessThanOrEqual(0.3);
    });
  }
});

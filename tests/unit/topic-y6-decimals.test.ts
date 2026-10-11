import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { parseNum, type Dec } from '../../src/curriculum/ks2num';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-decimals')!;
const draw = (d: Difficulty, n = 300) => { const r = rng(1265 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const D = (s: string): Dec => parseNum(s)!;
/** Exact value as a BigInt scaled by 10^6, so two labels compare without a float. */
const scaled = (s: string) => { const x = D(s); return BigInt(x.v) * 10n ** BigInt(6 - x.dp); };
const POW: Record<string, bigint> = { '10': 10n, '100': 100n, '1,000': 1000n, '10000': 10000n, '10,000': 10000n };
const SIX = 10n ** 6n;
/** The prompt solved with scaled integers only: ?-free "a op b = ?" gives the result; one unknown gives that unknown. */
function solve(p: string): bigint {
  const m = p.match(/^(\?|[\d.,]+) ([×÷]) (\?|[\d.,]+) = (\?|[\d.,]+)$/)!;
  const [, a, op, b, c] = m;
  const pw = (s: string) => POW[s];
  if (c === '?') return op === '×' ? scaled(a) * pw(b) : scaled(a) / pw(b);
  if (a === '?') return op === '×' ? scaled(c) / pw(b) : scaled(c) * pw(b);
  return (op === '×' ? scaled(c) / scaled(a) : scaled(a) / scaled(c)) * SIX;
}
const dp = (s: string) => (s.split('.')[1] ?? '').length;

describe('y6-decimals (#1265)', () => {
  it('is a Year 6 fractions topic', () => {
    expect([topic.year, topic.subject, topic.strand]).toEqual(['year6', 'maths', 'fractions']);
  });

  it('fixed table: 4.078 → 0.07; 0.72 × 1,000 = 720; 45.6 ÷ 100 = 0.456', () => {
    expect(solve('0.72 × 1,000 = ?')).toBe(scaled('720'));
    expect(solve('45.6 ÷ 100 = ?')).toBe(scaled('0.456'));
    expect(solve('3.6 × ? = 3,600')).toBe(1000n * SIX);
    expect(solve('? ÷ 100 = 0.045')).toBe(scaled('4.5'));
  });

  it('d2 and d3 cover both operations, all three powers and both d3 forms', () => {
    const seen = new Set<string>();
    for (const c of draw(2)) seen.add(`d2 ${c.prompt.match(/[×÷] ([\d,]+)/)![0]}`);
    for (const c of draw(3)) seen.add(c.prompt.startsWith('?') ? `start ${c.prompt.match(/[×÷] ([\d,]+)/)![0]}` : `power ${c.prompt.match(/[×÷]/)![0]}`);
    for (const op of ['×', '÷']) for (const p of ['10', '100', '1,000']) { expect(seen, `d2 ${op} ${p}`).toContain(`d2 ${op} ${p}`); expect(seen, `start ${op} ${p}`).toContain(`start ${op} ${p}`); }
    expect(seen).toContain('power ×'); expect(seen).toContain('power ÷');
  });

  it('d1: the answer is digit × place value, and the asked digit appears once', () => {
    for (const c of draw(1)) {
      const m = c.prompt.match(/^What is the value of the (\d) in ([\d.]+)\?$/)!;
      const [, digit, num] = m;
      expect(num.split('').filter(x => x === digit)).toHaveLength(1);
      const [w, f] = num.split('.');
      expect(f).toHaveLength(3); expect(w.length).toBeLessThanOrEqual(2);
      const pos = num.indexOf(digit);
      const place = pos < w.length ? 10n ** BigInt(w.length - 1 - pos) * SIX : 10n ** BigInt(6 - (pos - w.length)) ;
      expect(scaled(c.answer)).toBe(BigInt(digit) * place);
    }
  });

  it('d2 and d3: the oracle holds on every card (scaled integers only)', () => {
    for (const d of [2, 3] as Difficulty[]) for (const c of draw(d)) {
      const want = c.prompt.includes('?') && c.prompt.endsWith('= ?') ? solve(c.prompt) : null;
      if (want !== null) expect(scaled(c.answer), c.prompt).toBe(want);
      else if (/^\? /.test(c.prompt)) expect(scaled(c.answer), c.prompt).toBe(solve(c.prompt));
      else expect(BigInt(c.answer.replace(/,/g, '')) * SIX, c.prompt).toBe(solve(c.prompt));
    }
  });

  it('every answer and decoy has at most 3 decimal places, no trailing zero and no float artefact', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d)) {
      expect(c.options).toHaveLength(4); expect(new Set(c.options).size).toBe(4); expect(c.options).toContain(c.answer);
      expect(new Set(c.options.map(scaled)).size, c.prompt).toBe(4);
      for (const o of [...c.options, c.prompt.match(/[\d.,]+/g)!.join(' ')]) {
        expect(o, c.prompt).not.toMatch(/\.\d*0(?!\d)/);
        expect(o, c.prompt).not.toMatch(/\.\d{4,}/);
      }
      for (const o of c.options) expect(dp(o), o).toBeLessThanOrEqual(3);
    }
  });

  it('d2 answers are at most 100,000 and the shift decoy is on every card', () => {
    for (const c of draw(2)) {
      expect(scaled(c.answer)).toBeLessThanOrEqual(100000n * SIX);
      const a = scaled(c.answer);
      const shifted = c.options.some(o => { const x = scaled(o); return x !== a && [10n, 100n].some(k => x === a * k || x * k === a); });
      expect(shifted, c.prompt).toBe(true);
    }
  });

  it('every card has a place-value-shift decoy', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d)) {
      const a = scaled(c.answer);
      expect(c.options.some(o => { const x = scaled(o); return x !== a && (x % a === 0n && /^10*$/.test(String(x / a)) || a % x === 0n && /^10*$/.test(String(a / x))); }), c.prompt).toBe(true);
    }
  });

  it('say reads no raw decimal point or comma number', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d, 60)) {
      expect(c.say, c.prompt).toBeTruthy();
      expect(c.say).not.toMatch(/\d\.\d/);
      expect(sayIsSafe(c.say!), c.say).toBe(true);
    }
  });

  it('decoy leak shares stay at or under 0.30 at every difficulty', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const s = leakShares(topic.gen, d);
      expect(s.units, `d${d} last digit`).toBeLessThanOrEqual(0.30);
      expect(s.leading, `d${d} leading digit`).toBeLessThanOrEqual(0.30);
    }
  });
});

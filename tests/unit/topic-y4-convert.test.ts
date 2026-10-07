import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { parseNum, fmt, dec } from '../../src/curriculum/ks2num';
import { sayIsSafe } from '../../src/curriculum/ks2say';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y4-convert')!;
const draw = (d: Difficulty, n: number) => { const r = rng(1150 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };

// The test's own table, written separately from the module's: [bigger, smaller, factor] in tenths-free whole units.
const TABLE: [string, string, number][] = [['km', 'm', 1000], ['m', 'cm', 100], ['cm', 'mm', 10], ['kg', 'g', 1000], ['l', 'ml', 1000],
  ['hour', 'minute', 60], ['minute', 'second', 60], ['year', 'month', 12], ['week', 'day', 7]];
const norm = (u: string) => u.replace(/s$/, '').replace(/^(hours?|minutes?|seconds?|years?|months?|weeks?|days?)$/, m => m);
const factor = (big: string, small: string) => TABLE.find(([b, s]) => b === norm(big) && s === norm(small))?.[2];
/** Exact value in thousandths of a unit: parsed from the label, no float. */
const thousandths = (s: string) => { const d = parseNum(s)!; return d.v * 10 ** (3 - d.dp); };
const UNIT = '(km|cm|mm|kg|ml|m|g|l|hours?|minutes?|seconds?|years?|months?|weeks?|days?)';

interface Parsed { from: string; to: string; value: number }   // value in thousandths of `from`
function parse(q: Question): Parsed {
  let m = q.prompt.match(new RegExp(`^([\\d,.]+) ${UNIT} = \\? ${UNIT}$`));
  if (m) return { from: m[2], to: m[3], value: thousandths(m[1]) };
  m = q.prompt.match(new RegExp(`^(\\d+) ${UNIT} (\\d+) ${UNIT} = \\? ${UNIT}$`));   // "3 m 40 cm"
  if (m) { const f = factor(m[2], m[4])!; return { from: m[4], to: m[5], value: (Number(m[1]) * f + Number(m[3])) * 1000 }; }
  m = q.prompt.match(new RegExp(`^.* (\\d+) ${UNIT}( old)?\\. How many ${UNIT}\\?$`));  // sentence
  if (m) return { from: m[2], to: m[4], value: Number(m[1]) * 1000 };
  throw new Error(`unparsed: ${q.prompt}`);
}
/** The answer the test recomputes from its own table. */
function oracle(p: Parsed): number {
  const up = factor(p.to, p.from), down = factor(p.from, p.to);
  if (norm(p.from) === norm(p.to)) return p.value;              // a compound card is already in the smaller unit
  if (down) return p.value * down;                  // thousandths of the smaller unit
  if (up) return p.value / up;
  throw new Error(`no row for ${p.from} → ${p.to}`);
}
const answerOf = (q: Question) => thousandths(q.answer);

describe('y4-convert (#1150)', () => {
  it('is registered for Year 4 with the measure strand', () => { expect(topic.year).toBe('year4'); expect(topic.strand).toBe('measure'); expect(topic.title).toBe('Converting Units'); });

  for (const d of [1, 2, 3] as Difficulty[]) {
    it(`d${d}: the answer equals the card recomputed from the test's own table; four unique options; ≤ 20,000`, () => {
      for (const q of draw(d, 400)) {
        expect(answerOf(q), q.prompt).toBe(oracle(parse(q)));
        expect(q.options).toHaveLength(4); expect(new Set(q.options).size).toBe(4); expect(q.options).toContain(q.answer);
        for (const o of q.options) { const v = parseNum(o)!; expect(v, o).not.toBeNull(); expect(v.dp).toBeLessThanOrEqual(1); expect(o).not.toMatch(/\d{4}/); expect(thousandths(o)).toBeGreaterThanOrEqual(0); expect(thousandths(o)).toBeLessThanOrEqual(20_000_000); }
        expect(sayIsSafe(q.say!), q.say).toBe(true);
        expect(q.say).not.toMatch(/\b(km|cm|mm|kg|ml)\b/);
      }
    });
  }

  it('d1 only converts the larger unit to the smaller, 1–9 of it', () => {
    for (const q of draw(1, 400)) { const p = parse(q); expect(factor(p.from, p.to), q.prompt).toBeDefined(); expect(p.value / 1000).toBeGreaterThanOrEqual(1); expect(p.value / 1000).toBeLessThanOrEqual(9); }
  });

  it('d2 goes both ways with whole-number answers', () => {
    const dirs = new Set<string>();
    for (const q of draw(2, 400)) { const p = parse(q); dirs.add(factor(p.from, p.to) ? 'down' : 'up'); expect(answerOf(q) % 1000, q.prompt).toBe(0); }
    expect([...dirs].sort()).toEqual(['down', 'up']);
  });

  it('every row of the table is reached over d1–d3, and every count of four digits has its comma', () => {
    const seen = new Set<string>(); let commas = 0;
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 600)) {
      const p = parse(q); const row = TABLE.find(([b, s]) => (b === norm(p.from) && s === norm(p.to)) || (s === norm(p.from) && b === norm(p.to)) || (norm(p.from) === norm(p.to) && s === norm(p.from)))!;
      seen.add(row.join('>')); if (/\d,\d{3}/.test(q.prompt + q.answer)) commas++;
    }
    expect(seen.size).toBe(9); expect(commas).toBeGreaterThan(0);
    expect(fmt(dec(30000, 1))).toBe('3,000');
  });

  it('d3 is slow on every card; d1 and d2 on none; d3 carries decimals, compounds and sentences', () => {
    draw(1, 100).concat(draw(2, 100)).forEach(q => expect(q.slow).toBeUndefined());
    let dec1 = 0, comp = 0, sent = 0;
    for (const q of draw(3, 400)) {
      expect(q.slow).toBe(true);
      if (/How many/.test(q.prompt)) sent++; else if (/^\d+ \S+ \d+ \S+ = /.test(q.prompt)) comp++;
      if (/\.\d/.test(q.prompt + q.answer)) dec1++;
    }
    expect(dec1).toBeGreaterThan(20); expect(comp).toBeGreaterThan(20); expect(sent).toBeGreaterThan(20);
  });

  it('the place-value slip is always a decoy where one is valid', () => {
    for (const d of [1, 2] as Difficulty[]) for (const q of draw(d, 400)) {
      const a = answerOf(q), opts = q.options.map(thousandths);
      const slips = [10, 100, 1000].map(k => a * k).concat([10, 100, 1000].map(k => a / k)).filter(v => Number.isInteger(v) && v > 0 && v <= 20_000_000 && v % 100 === 0 && v !== a);
      if (slips.length >= 1) expect(opts.some(o => slips.includes(o)), q.prompt).toBe(true);
    }
  });

  it('leak limit: ≤ 30 % of qualifying cards have a last or leading digit no decoy shares', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      let n = 0, lastBad = 0, leadBad = 0;
      for (const q of draw(d, 2000)) {
        const a = parseNum(q.answer)!; if (a.dp === 0 && a.v < 20) continue;
        const digits = (s: string) => s.replace(/[^0-9]/g, ''), ad = digits(q.answer), others = q.options.filter(o => o !== q.answer).map(digits);
        n++; if (!others.some(o => o.slice(-1) === ad.slice(-1))) lastBad++; if (!others.some(o => o[0] === ad[0])) leadBad++;
      }
      if (n) { expect(lastBad / n, `d${d} last`).toBeLessThanOrEqual(0.3); expect(leadBad / n, `d${d} lead`).toBeLessThanOrEqual(0.3); }
    }
  });
});

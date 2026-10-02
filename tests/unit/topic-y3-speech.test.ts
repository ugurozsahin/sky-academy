import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { REPORTING_FIRST, SPEECH_FIRST, version } from '../../src/curriculum/year3-speech';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y3-speech')!;
const draws = (d: Difficulty, seed: number, n = 300) => { const r = rng(seed + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const EXCLUDE = new Set(['gay', 'queer', 'bitch', 'butt']);
const bank = [...SPEECH_FIRST.map(r => ({ r, first: false })), ...REPORTING_FIRST.map(r => ({ r, first: true }))];
const textOf = (q: { visual?: unknown }) => (q.visual as { text: string }).text;
const lines = (q: { visual?: unknown }) => textOf(q).split('\n').map(l => ({ label: l[0], text: l.slice(3) }));
/** What the child must see: the text between the first “ and the next ”, and nothing else, equals the spoken words. */
const passes = (v: string, spoken: string) => { const m = /^[^“”]*“([^“”]*)”[^“”]*$/.exec(v); return !!m && m[1] === spoken; };
const marks = (s: string) => s.replace(/[^,.!?]/g, '');
const bare = (t: string) => t.replace(/[\u201C\u201D]/g, '');
const rowOf = (text: string) => bank.find(b => bare(text) === (b.first ? `${b.r[1]} ${b.r[0]}` : `${b.r[0]} ${b.r[1]}`))!;

describe('y3-speech (#1110)', () => {
  it('is registered once, in Year 3 writing', () => {
    expect(TOPICS.filter(t => t.id === 'y3-speech')).toHaveLength(1);
    expect(topic.year).toBe('year3');
    expect(topic.subject).toBe('writing');
  });

  it('the bank has at least 20 rows with unique text, and the end marks sit where Appendix 2 puts them', () => {
    expect(bank.length).toBeGreaterThanOrEqual(20);
    expect(new Set(bank.map(b => b.r.join('|'))).size).toBe(bank.length);
    for (const [s] of SPEECH_FIRST) expect(s, s).toMatch(/[,?!]$/);
    for (const [s] of REPORTING_FIRST) expect(s, s).toMatch(/[.?!]$/);
    for (const [, c] of SPEECH_FIRST) expect(c, c).toMatch(/\.$/);
    for (const [, c] of REPORTING_FIRST) expect(c, c).toMatch(/,$/);
  });

  it('oracle: for every bank row exactly one of the five versions has the marks round precisely the spoken words', () => {
    for (const { r, first } of bank) {
      const vs = (['right', 'no-close', 'reporting', 'whole', 'late-open'] as const).map(h => version(r, first, h));
      expect(new Set(vs).size, r.join(' ')).toBe(5);
      expect(vs.filter(v => passes(v, r[0])), r.join(' ')).toEqual([vs[0]]);
      expect(vs.every(v => marks(v) === marks(vs[0])), r.join(' ')).toBe(true);
      expect(vs.every(v => v.replace(/[“”]/g, '') === vs[0].replace(/[“”]/g, '')), r.join(' ')).toBe(true);
    }
  });

  it('every drawn card has exactly one passing version, in the right letter, with the same words and the same , . ! ? in each', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d, 1110_100)) {
      const ls = lines(q);
      expect(q.prompt).toBe('Which has the inverted commas in the right place?');
      expect(q.say).toBe(q.prompt);
      expect(ls.map(l => l.label)).toEqual(['A', 'B', 'C'].slice(0, d === 1 ? 2 : 3));
      expect([...q.options].sort()).toEqual(ls.map(l => l.label));
      const rows = new Set(ls.map(l => rowOf(l.text)));
      expect(rows.size, textOf(q)).toBe(1);
      const { r } = [...rows][0];
      expect(ls.filter(l => passes(l.text, r[0])).map(l => l.label), textOf(q)).toEqual([q.answer]);
      expect(new Set(ls.map(l => l.text)).size).toBe(ls.length);
      expect(new Set(ls.map(l => marks(l.text))).size, textOf(q)).toBe(1);
    }
  });

  it('ladder: d1 two versions and speech first only, d2 three versions and speech first only, d3 three versions with both orders', () => {
    const reportingFirst = (q: ReturnType<typeof draws>[number]) => rowOf(lines(q)[0].text).first;
    for (const q of draws(1, 1110_200)) { expect(lines(q)).toHaveLength(2); expect(reportingFirst(q)).toBe(false); }
    for (const q of draws(2, 1110_300)) { expect(lines(q)).toHaveLength(3); expect(reportingFirst(q)).toBe(false); }
    const d3 = draws(3, 1110_400);
    expect(d3.every(q => lines(q).length === 3)).toBe(true);
    expect(d3.some(reportingFirst) && d3.some(q => !reportingFirst(q))).toBe(true);
  });

  it('the right version is not always the same letter', () => {
    for (const d of [1, 2, 3] as Difficulty[]) expect(new Set(draws(d, 1110_500).map(q => q.answer)).size, `d${d}`).toBe(d === 1 ? 2 : 3);
  });

  it('every spoken part and reporting clause has at least two words, so late-open never equals right', () => {
    for (const { r } of bank) for (const part of r) expect(part.split(' ').length, part).toBeGreaterThanOrEqual(2);
  });

  it('the wrong versions drawn cover the misplacements: d1 no-close and whole, d2 and d3 all four', () => {
    const kind = (q: ReturnType<typeof draws>[number]) => {
      const ls = lines(q), { r, first } = rowOf(ls[0].text);
      return ls.filter(l => !passes(l.text, r[0])).map(l => (['no-close', 'reporting', 'whole', 'late-open'] as const).find(h => version(r, first, h) === l.text)!);
    };
    expect(new Set(draws(1, 1110_600).flatMap(kind))).toEqual(new Set(['no-close', 'whole']));
    for (const d of [2, 3] as Difficulty[]) expect(new Set(draws(d, 1110_700).flatMap(kind)), `d${d}`).toEqual(new Set(['no-close', 'reporting', 'whole', 'late-open']));
  });

  it('is deterministic for a seed', () => {
    expect(draws(3, 1110_800, 20)).toEqual(draws(3, 1110_800, 20));
  });

  it('every version fits one line: at most 30 characters', () => {
    for (const { r, first } of bank) for (const h of ['right', 'no-close', 'reporting', 'whole', 'late-open'] as const)
      expect(version(r, first, h).length, version(r, first, h)).toBeLessThanOrEqual(30);
  });

  it('no bank word is in AVOID or the local EXCLUDE set', () => {
    for (const { r } of bank) for (const w of r.join(' ').toLowerCase().match(/[a-z]+/g) ?? []) {
      expect(AVOID.has(w), w).toBe(false);
      expect(EXCLUDE.has(w), w).toBe(false);
    }
  });
});

import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { BANK, KINDS, DASH, build, gapped, uniqueWords, type Kind } from '../../src/curriculum/year5-parenthesis';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-parenthesis')!;
const EXCLUDE = new Set(['gay', 'queer', 'bitch', 'butt']);
const draws = (d: Difficulty, n = 300) => { const r = rng(1226 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const count = (s: string, ch: string) => s.split(ch).length - 1;
const PARTNER: Record<string, string> = { '(': ')', ')': '(', ',': ',', [DASH]: DASH };
const wordsIn = (s: string): string[] => s.toLowerCase().match(/[a-z0-9]+/g) ?? [];

describe('y5-parenthesis (#1226)', () => {
  it('is registered once in Year 5 grammar with a plain title', () => {
    expect(TOPICS.filter(t => t.id === 'y5-parenthesis')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year5', subject: 'writing', strand: 'grammar', title: 'Parenthesis: brackets, dashes, commas' });
  });

  it('every sentence holds exactly one pair, and no other bracket, dash or comma', () => {
    for (const row of BANK) for (const kind of KINDS) {
      const s = build(row, kind);
      const marks = { bracket: ['(', ')'], comma: [',', ','], dash: [DASH, DASH] }[kind];
      expect(count(s, '('), s).toBe(kind === 'bracket' ? 1 : 0);
      expect(count(s, ')'), s).toBe(kind === 'bracket' ? 1 : 0);
      expect(count(s, ','), s).toBe(kind === 'comma' ? 2 : 0);
      expect(count(s, DASH), s).toBe(kind === 'dash' ? 2 : 0);
      expect(s.includes('-'), s).toBe(false);
      expect(s.indexOf(marks[0]), s).toBeLessThan(s.lastIndexOf(marks[1]));
    }
  });

  it('the bank is unique, and no word in it is in AVOID or the local EXCLUDE set', () => {
    expect(new Set(BANK.map(r => r.join('|'))).size).toBe(BANK.length);
    for (const row of BANK) for (const w of wordsIn(row.join(' '))) {
      expect(AVOID.has(w), w).toBe(false);
      expect(EXCLUDE.has(w), w).toBe(false);
    }
  });

  it('every row offers a unique inside word and at least three unique outside words', () => {
    for (const row of BANK) {
      const s = build(row, 'bracket');
      expect(uniqueWords(row[1], s).length, s).toBeGreaterThanOrEqual(1);
      expect(uniqueWords(row[0] + row[2], s).length, s).toBeGreaterThanOrEqual(3);
    }
  });

  it('d1/d2 oracle: the answer is the partner of the mark left in the gapped sentence', () => {
    for (const row of BANK) for (const kind of KINDS) for (const side of ['open', 'close'] as const) {
      const g = gapped(row, kind, side), full = build(row, kind);
      expect(count(g, '_'), g).toBe(1);
      const missing = full[g.indexOf('_')];
      const remaining = side === 'open' ? full[full.lastIndexOf(PARTNER[missing])] : full[full.indexOf(PARTNER[missing])];
      expect(PARTNER[missing], g).toBe(remaining);
      expect(g.replace('_', missing), g).toBe(full);
    }
  });

  it('d1 is brackets only with 3 bubbles, d2 all kinds with 4, and the answer is the other half', () => {
    for (const q of draws(1)) {
      const text = (q.visual as { text: string }).text;
      expect([...q.options].sort()).toEqual(['(', ')', '.'].sort());
      expect(q.answer).toBe(text.includes('(') ? ')' : '(');
      expect(text).toMatch(/_/);
    }
    const seen = new Set<Kind>();
    for (const q of draws(2)) {
      const text = (q.visual as { text: string }).text;
      expect([...q.options].sort()).toEqual(['(', ')', ',', DASH].sort());
      const left = text.includes('(') ? '(' : text.includes(')') ? ')' : text.includes(DASH) ? DASH : ',';
      expect(q.answer).toBe(PARTNER[left]);
      seen.add(left === ',' ? 'comma' : left === DASH ? 'dash' : 'bracket');
    }
    expect(seen.size).toBe(3);
  });

  it('d3: the intact sentence has exactly one option between the pair, and it is the answer', () => {
    for (const q of draws(3)) {
      const text = (q.visual as { text: string }).text;
      expect(q.options).toHaveLength(4);
      expect(q.prompt).toBe('Which word is inside the parenthesis?');
      const [open, close] = text.includes('(') ? ['(', ')'] : text.includes(DASH) ? [DASH, DASH] : [',', ','];
      const inside = text.slice(text.indexOf(open) + 1, text.lastIndexOf(close));
      const between = q.options.filter(o => wordsIn(inside).includes(o.toLowerCase()));
      expect(between, text).toEqual([q.answer]);
      for (const o of q.options) expect(wordsIn(text).filter(w => w === o.toLowerCase()), o).toHaveLength(1);
    }
  });

  it('every card has a sentence visual and a say that never reads a mark aloud; no bubble is crude', () => {
    for (const d of [1, 2, 3] as const) for (const q of draws(d, 120)) {
      expect(q.visual?.type).toBe('sentence');
      expect(q.say).toBeTruthy();
      expect(q.say).not.toMatch(/[()–_]/);
      for (const o of q.options) { expect((AVOID as Set<string>).has(o.toLowerCase()), o).toBe(false); expect(EXCLUDE.has(o.toLowerCase()), o).toBe(false); }
      if (d === 3) for (const o of q.options) expect(o.toLowerCase()).not.toContain('parenthesis');
    }
  });
});

// #2322: the shapes the "less to read" change gave the reading-load games at their first difficulty, pinned so a bank edit cannot undo them.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { SENTENCE_TYPES } from '../../src/curriculum/year2/sentences';

const rngOf = (s: number) => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const gen = (id: string, d: Difficulty, n = 400) => { const t = TOPICS.find(x => x.id === id)!, r = rngOf(2322 + d); return Array.from({ length: n }, () => t.gen(d, r)); };
const PICS = ['🌅', '☀️', '🌇'], PARTS = ['morning', 'afternoon', 'evening'], DAY_WORDS = ['yesterday', 'today', 'tomorrow'];

describe('y1-when day parts are pictures (#2322)', () => {
  it('d1: every card has the three pictures as bubbles, not wide, and the answer among them', () => {
    for (const q of gen('y1-when', 1)) {
      expect([...q.options].sort()).toEqual([...PICS].sort());
      expect(PICS).toContain(q.answer);
      expect(q.wide).toBe(false);
    }
  });
  it('d2/d3: a card whose bubbles are all day parts is pictures; any card mixing in yesterday/today/tomorrow stays words (the cross-list decoys are deliberate)', () => {
    let pictures = 0, words = 0;
    for (const d of [2, 3] as Difficulty[]) for (const q of gen('y1-when', d)) {
      const emoji = q.options.some(o => PICS.includes(o));
      if (emoji) { pictures++; expect(q.options.every(o => PICS.includes(o))).toBe(true); expect(q.wide).toBe(false); }
      else { words++; expect(q.options.every(o => PARTS.includes(o) || DAY_WORDS.includes(o))).toBe(true); }
      expect(q.options).toContain(q.answer);
    }
    expect(pictures).toBeGreaterThan(0);
    expect(words).toBeGreaterThan(0);
  });
});

describe('y1-plurals bubbles (#2322)', () => {
  it('offers s and es at d1/d2, adds ies at d3, and ies is never the answer', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of gen('y1-plurals', d, 200)) {
      expect([...q.options].sort()).toEqual(d === 3 ? ['es', 'ies', 's'] : ['es', 's']);
      expect(['s', 'es']).toContain(q.answer);
    }
  });

  it('the prompt is the bare "two <word>__" sentence, with no "one <word>" lead-in', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of gen('y1-plurals', d, 200)) {
      expect(q.prompt).toMatch(/^two [a-z]+__$/);
    }
  });
});

describe('y1-spelling gap cards (#2322)', () => {
  it('d2 gaps offer three letter bubbles with the answer among them', () => {
    for (const q of gen('y1-spelling', 2, 200)) {
      expect(q.options).toHaveLength(3);
      expect(q.options).toContain(q.answer);
    }
  });
});

describe('y2-sentencetype d1 (#2322)', () => {
  it('asks "What kind?" about a 4 to 5 word sentence and the pool holds both d1 types', () => {
    const short = SENTENCE_TYPES.filter(([s, t]) => s.split(' ').length >= 4 && s.split(' ').length <= 5 && (t === 'statement' || t === 'question'));
    expect(new Set(short.map(e => e[1]))).toEqual(new Set(['statement', 'question']));
    for (const q of gen('y2-sentencetype', 1, 200)) {
      expect(q.prompt).toBe('What kind?');
      const text = (q.visual as { text: string }).text;
      expect(text.split(' ').length).toBeGreaterThanOrEqual(4);
      expect(text.split(' ').length).toBeLessThanOrEqual(5);
    }
  });
});

describe('y3-conjunctions d1 (#2322)', () => {
  it('reads at most 7 words and draws from a non-empty pool of every conjunction', () => {
    const seen = new Set<string>();
    for (const q of gen('y3-conjunctions', 1)) {
      expect(q.prompt).toBe('Which word fits?');
      expect((q.visual as { text: string }).text.split(' ').length).toBeLessThanOrEqual(7);
      seen.add(q.answer);
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });
});

describe('words per wave at d1, the rest of the one-third cut (#2322)', () => {
  // prompt + printed visual text + bubbles, whitespace tokens, 400 seeded draws; before (#2363's table): 6.0 / 20.1 / 12.0
  const words = (id: string) => gen(id, 1).reduce((n, q) => n + [q.prompt, (q.visual as { text?: string } | undefined)?.text ?? '', ...q.options].join(' ').split(/\s+/).filter(Boolean).length, 0) / 400;
  it.each([['y1-spelling', 6.0], ['y3-conjunctions', 20.1], ['y2-anyorder', 12.0]] as const)('%s reads a third less than before', (id, before) => {
    expect(words(id)).toBeLessThanOrEqual(before * 2 / 3 + 1e-9);
  });
  it('y1-spelling d1 offers two letters, d2 three', () => {
    for (const q of gen('y1-spelling', 1, 200)) { expect(q.options).toHaveLength(2); expect(q.options).toContain(q.answer); }
  });
});

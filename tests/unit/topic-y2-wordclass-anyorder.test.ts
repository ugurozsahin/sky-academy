import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { WORD_CLASS_SETS, WORD_CLASSES } from '../../src/curriculum/year2-wordclass';

// Deterministic RNG (mulberry32), same construction curriculum.test.ts uses.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const FUNCTION_WORDS = new Set(['the', 'a', 'and', 'his', 'onto', 'past', 'across', 'at']);
const tokens = (s: string) => s.toLowerCase().match(/[a-z]+/g)!;

/** "Slice every noun / verb" (#927). Its own file: curriculum.test.ts is frozen at its length. */
describe('y2-wordclass "Slice Them All" form (#927)', () => {
  it('declares sequenceFrom 2 on the registry row', () => {
    expect(TOPICS.find(x => x.id === 'y2-wordclass')!.sequenceFrom).toBe(2);
  });

  describe('bank rail', () => {
    it('has at least 12 sentences, each with 2+ nouns, 2+ verbs and 4–6 content words', () => {
      expect(WORD_CLASS_SETS.length).toBeGreaterThanOrEqual(12);
      for (const [sent, nouns, verbs, others] of WORD_CLASS_SETS) {
        expect(nouns.length, sent).toBeGreaterThanOrEqual(2);
        expect(verbs.length, sent).toBeGreaterThanOrEqual(2);
        const content = [...nouns, ...verbs, ...others];
        expect(content.length, sent).toBeGreaterThanOrEqual(4);
        expect(content.length, sent).toBeLessThanOrEqual(6);
      }
    });
    it('keys every content word once, leaves only function words unkeyed, and shows no proper noun', () => {
      for (const [sent, nouns, verbs, others] of WORD_CLASS_SETS) {
        const content = [...nouns, ...verbs, ...others], words = tokens(sent);
        expect(new Set(content).size, `${sent}: a word is keyed twice`).toBe(content.length);
        for (const w of content) expect(words, `${w} is not in "${sent}"`).toContain(w);
        for (const w of words.filter(x => !content.includes(x))) expect(FUNCTION_WORDS, `"${w}" in "${sent}" is neither keyed nor a function word`).toContain(w);
        expect(sent.slice(1), `${sent} has a capital that gives a word away`).not.toMatch(/[A-Z]/);
      }
    });
    it('keeps every word in one class across the bank, out of AVOID, and out of the single-word bank\'s other classes', () => {
      const classOf = new Map<string, string>();
      const claim = (w: string, c: string) => { expect(classOf.get(w) ?? c, `${w} is used as both a ${classOf.get(w)} and a ${c}`).toBe(c); classOf.set(w, c); };
      for (const [, nouns, verbs, others] of WORD_CLASS_SETS) {
        nouns.forEach(w => claim(w, 'noun')); verbs.forEach(w => claim(w, 'verb')); others.forEach(w => claim(w, 'adjective'));
      }
      for (const row of WORD_CLASSES) { claim(row[1], 'noun'); claim(row[2], 'verb'); claim(row[3], 'adjective'); claim(row[4], 'adverb'); }
      for (const w of classOf.keys()) expect(AVOID.has(w), `${w} is in AVOID`).toBe(false);
    });
  });

  it('draws about 1 card in 3 at d2–d3; d1 never; targets are exactly the asked class, every bubble is a content word', () => {
    const t = TOPICS.find(x => x.id === 'y2-wordclass')!;
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(9270 + d), DRAWS = 900;
      let anyOrder = 0; const asked = new Set<string>();
      for (let i = 0; i < DRAWS; i++) {
        const q = t.gen(d, r);
        if (!q.anyOrder) continue;
        anyOrder++;
        const m = q.prompt.match(/^Slice every (noun|verb)$/);
        expect(m, q.prompt).toBeTruthy();
        const cls = m![1]; asked.add(cls);
        const sent = (q.visual as { type: string; text: string }).text;
        const set = WORD_CLASS_SETS.find(e => e[0] === sent)!;
        expect(set, sent).toBeTruthy();
        const want = cls === 'noun' ? set[1] : set[2];
        expect([...q.sequence!].sort(), `${sent} — ${cls}`).toEqual([...want].sort());
        expect([...q.options].sort(), `${sent}: every bubble is one of its content words`).toEqual([...set[1], ...set[2], ...set[3]].sort());
        for (const o of q.options.filter(o => !want.includes(o))) expect(want, `${o} is a decoy`).not.toContain(o);
        expect(q.hint, 'the hint never names a word').not.toMatch(new RegExp(`\\b(${set[1].concat(set[2]).join('|')})\\b`));
      }
      if (d === 1) expect(anyOrder, 'd1 is unchanged').toBe(0);
      else {
        expect(anyOrder / DRAWS, `d${d} any-order share`).toBeGreaterThan(0.25);
        expect(anyOrder / DRAWS, `d${d} any-order share`).toBeLessThan(0.42);
        expect([...asked].sort(), `d${d}`).toEqual(d === 2 ? ['noun'] : ['noun', 'verb']);
      }
    }
  });
});

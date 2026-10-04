import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { GAP_WORDS, AVOID } from '../../src/curriculum/util';
import { Y1_SPELL_RULES } from '../../src/curriculum/year1';

// Deterministic RNG (mulberry32), same construction curriculum.test.ts uses.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

describe('y1-spellrules "Find the right spelling" (#990)', () => {
  const t = TOPICS.find(x => x.id === 'y1-spellrules')!;
  const bank = new Map(Y1_SPELL_RULES.map(([w, f, ds]) => [w, { f, ds }]));
  const DRAWS = 200;
  const draw = (d: Difficulty) => { const r = rng(9900 + d); return Array.from({ length: DRAWS }, () => t.gen(d, r)); };
  const RULE: Record<string, RegExp> = { double: /(ff|ll|ss|zz|ck)$/, nk: /nk$/, tch: /tch$/, ve: /ve$/ };

  it('is registered for Year 1 writing, directly after y1-spelling', () => {
    expect(t.year).toBe('year1');
    expect(t.subject).toBe('writing');
    const ids = TOPICS.map(x => x.id);
    expect(ids.indexOf('y1-spellrules')).toBe(ids.indexOf('y1-spelling') + 1);
  });

  it('the bank has at least 6 words per family and 24 in all, each with exactly 2 decoys', () => {
    expect(Y1_SPELL_RULES.length).toBeGreaterThanOrEqual(24);
    for (const f of ['double', 'nk', 'tch', 've']) expect(Y1_SPELL_RULES.filter(e => e[1] === f).length, f).toBeGreaterThanOrEqual(6);
    for (const [w, , ds] of Y1_SPELL_RULES) expect(new Set(ds).size, w).toBe(2);
  });

  it('oracle: the answer is the bank word and the options are exactly the word plus its 2 decoys', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      const e = bank.get(q.answer)!;
      expect(e, q.answer).toBeDefined();
      expect(q.options.slice().sort(), q.answer).toEqual([q.answer, ...e.ds].sort());
      expect(RULE[e.f].test(q.answer), `${q.answer} ends in its rule`).toBe(true);
    }
  });

  it('every decoy breaks exactly its entry\'s rule, is a non-word and is never a gap word or in AVOID', () => {
    const words = new Set(Y1_SPELL_RULES.map(e => e[0]));
    for (const [w, f, ds] of Y1_SPELL_RULES) for (const x of ds) {
      expect(RULE[f].test(x), `${x} (for ${w}) still follows the rule`).toBe(false);
      expect(words.has(x) || GAP_WORDS.has(x), `${x} is a real word`).toBe(false);
      expect(AVOID.has(x), `${x} is in AVOID`).toBe(false);
    }
  });

  it('every card speaks the whole word and peeks with no voice, and never prints it', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(q.listen).toBe(q.answer);
      expect(q.peek).toBe(true);
      expect(q.say).toContain(q.answer);
      expect(q.prompt).not.toContain(q.answer);
      expect(q.visual).toBeUndefined();
    }
  });

  it('the ladder grows by family: d1 double only, d2 adds nk and -ve, d3 adds -tch', () => {
    const fams = (d: Difficulty) => new Set(draw(d).map(q => bank.get(q.answer)!.f));
    expect([...fams(1)]).toEqual(['double']);
    expect([...fams(2)].sort()).toEqual(['double', 'nk', 've']);
    expect([...fams(3)].sort()).toEqual(['double', 'nk', 'tch', 've']);
  });
});

import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { GAP_WORDS, AVOID } from '../../src/curriculum/util';
import { Y1_SPELL_RULES2 } from '../../src/curriculum/year1-spell';

// Deterministic RNG (mulberry32), same construction curriculum.test.ts uses.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

describe('y1-spellrules2 "Find the right spelling" (#991)', () => {
  const t = TOPICS.find(x => x.id === 'y1-spellrules2')!;
  const bank = new Map(Y1_SPELL_RULES2.map(([w, f, ds]) => [w, { f, ds }]));
  const DRAWS = 300;
  const draw = (d: Difficulty) => { const r = rng(9910 + d); return Array.from({ length: DRAWS }, () => t.gen(d, r)); };
  const RULE: Record<string, RegExp> = { ai: /ai/, ay: /ay$/, oi: /oi/, oy: /oy$/, y: /y$/, k: /k[eiy]/, ph: /ph/, wh: /wh/ };

  it('is registered for Year 1 writing, directly after y1-spellrules', () => {
    expect(t.year).toBe('year1');
    expect(t.subject).toBe('writing');
    const ids = TOPICS.map(x => x.id);
    expect(ids.indexOf('y1-spellrules2')).toBe(ids.indexOf('y1-spellrules') + 1);
  });

  it('the bank has at least 5 words per family, 25 in all, each with exactly 2 decoys', () => {
    expect(Y1_SPELL_RULES2.length).toBeGreaterThanOrEqual(25);
    for (const f of Object.keys(RULE)) expect(Y1_SPELL_RULES2.filter(e => e[1] === f).length, f).toBeGreaterThanOrEqual(5);
    for (const [w, , ds] of Y1_SPELL_RULES2) expect(new Set(ds).size, w).toBe(2);
    for (const w of bank.keys()) expect(w, 'a lowercase common word, never a proper noun').toMatch(/^[a-z]+$/);
  });

  it('oracle: the answer is the bank word and the options are exactly the word plus its 2 decoys', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      const e = bank.get(q.answer)!;
      expect(e, q.answer).toBeDefined();
      expect(q.options.slice().sort(), q.answer).toEqual([q.answer, ...e.ds].sort());
      expect(RULE[e.f].test(q.answer), `${q.answer} follows its rule`).toBe(true);
    }
  });

  it('every decoy breaks its entry\'s rule, is a non-word and is never a gap word or in AVOID', () => {
    const words = new Set(Y1_SPELL_RULES2.map(e => e[0]));
    for (const [w, f, ds] of Y1_SPELL_RULES2) for (const x of ds) {
      expect(RULE[f].test(x), `${x} (for ${w}) still follows the rule`).toBe(false);
      expect(words.has(x) || GAP_WORDS.has(x), `${x} is a real word`).toBe(false);
      expect(AVOID.has(x), `${x} is in AVOID`).toBe(false);
    }
  });

  // Real English words said like a bank word (#1837 review): the bank and GAP_WORDS cannot catch these, so
  // they are named. A child who hears "tail" and slices *tael* has spelt the sound correctly.
  const HOMOPHONES = ['tael', 'dey', 'wych', 'wen', 'rein', 'reign', 'whin', 'wail', 'wale', 'weigh', 'whey', 'wear', 'ware', 'witch', 'tale', 'trey', 'sleigh'];
  it('no decoy is a known real-word homophone (tael, dey, wych, …)', () => {
    expect(Y1_SPELL_RULES2.flatMap(e => e[2]).filter(x => HOMOPHONES.includes(x))).toEqual([]);
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

  it('the ladder grows by family: d1 ai/ay/oi/oy, d2 adds y and k, d3 adds ph and wh', () => {
    const fams = (d: Difficulty) => new Set(draw(d).map(q => bank.get(q.answer)!.f));
    expect([...fams(1)].sort()).toEqual(['ai', 'ay', 'oi', 'oy']);
    expect([...fams(2)].sort()).toEqual(['ai', 'ay', 'k', 'oi', 'oy', 'y']);
    expect([...fams(3)].sort()).toEqual(['ai', 'ay', 'k', 'ph', 'oi', 'oy', 'wh', 'y'].sort());
  });
});

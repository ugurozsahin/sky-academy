import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { REGULAR_BANK, IRREGULAR_BANK, VERB_FRAMES } from '../../src/curriculum/year4-plural-poss';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y4-plural-poss')!;
const BANK = [...REGULAR_BANK, ...IRREGULAR_BANK];
// `AVOID` is a gap-spelling denylist and lists no crude whole words (G13): a short local set too.
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];
const EXCLUDED_NOUNS = ['sheep', 'fish', 'deer'];

/** The test's own apostrophe rule, independent of the generator's construction. */
function oracle(text: string): string {
  const frame = /^the (\w+) of (one|two) (\w+): the ___ \w+$/.exec(text);
  if (!frame) throw new Error(`not a meaning-phrase card: ${text}`);
  const [, , count, owner] = frame;
  if (count === 'one') return `${owner}'s`;
  return owner.endsWith('s') ? `${owner}'` : `${owner}'s`;
}

describe('y4-plural-poss (#1163)', () => {
  it('is registered once in Year 4 grammar', () => {
    expect(TOPICS.filter(t => t.id === 'y4-plural-poss')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year4', subject: 'writing', strand: 'grammar', title: 'Plural and Possessive -s' });
  });

  it('the bank is clean: no plural equals its singular, no singular ends in s, no excluded word', () => {
    for (const [one, many, owned] of BANK) {
      expect(many, `${one}: plural differs`).not.toBe(one);
      expect(one.endsWith('s'), `${one} ends in s`).toBe(false);
      expect(EXCLUDED_NOUNS.some(n => [one, many, owned].includes(n))).toBe(false);
      for (const bad of [...AVOID, ...EXCLUDE]) expect(`${one} ${many} ${owned}`.includes(bad), `${one}: ${bad}`).toBe(false);
    }
    for (const f of VERB_FRAMES) for (const bad of [...AVOID, ...EXCLUDE]) expect(f.toLowerCase().includes(bad)).toBe(false);
    expect(IRREGULAR_BANK.every(r => !r[1].endsWith('s'))).toBe(true);
  });

  it('the oracle picks the answer on every card, and exactly one option satisfies it', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (let s = 1; s <= 300; s++) {
      const q = topic.gen(d, rng(s * 7 + d));
      const text = (q.visual as { text: string }).text;
      expect(q.options).toHaveLength(3);
      expect(new Set(q.options).size).toBe(3);
      for (const o of q.options) expect(o, 'ASCII apostrophe only').toMatch(/^[a-z']+$/);
      if (/^the /.test(text)) {
        const want = oracle(text);
        expect(q.answer).toBe(want);
        expect(q.options.filter(o => o === want)).toHaveLength(1);
      } else {
        // a verb follows the gap: only the plain plural is grammatical, so it is the one option without an apostrophe
        expect(text).toMatch(/^The ___ (are|were|have) /);
        expect(q.options.filter(o => !o.includes("'"))).toEqual([q.answer]);
        expect(BANK.some(r => r[1] === q.answer)).toBe(true);
      }
    }
  });

  it('builds the ladder: irregular plurals from d2, the sentence form only at d3', () => {
    const irregular = new Set(IRREGULAR_BANK.map(r => r[1]));
    for (const d of [1, 2, 3] as Difficulty[]) {
      let irr = 0, sentence = 0;
      const answers = new Set<string>();
      for (let s = 1; s <= 600; s++) {
        const q = topic.gen(d, rng(s * 13 + d));
        const text = (q.visual as { text: string }).text;
        answers.add(q.answer);
        if (!/^the /.test(text)) sentence++;
        if ([...irregular].some(p => q.answer.startsWith(p))) irr++;
        expect(text).toContain('___');
        for (const n of EXCLUDED_NOUNS) expect(text.includes(n)).toBe(false);
      }
      expect(irr > 0, `d${d} irregular`).toBe(d !== 1);
      expect(sentence > 0, `d${d} sentence form`).toBe(d === 3);
    }
  });

  it('pins the whole answer inventory', () => {
    const all = new Set<string>();
    for (const d of [1, 2, 3] as Difficulty[]) for (let s = 1; s <= 1500; s++) for (const o of topic.gen(d, rng(s * 5 + d)).options) all.add(o);
    expect([...all].sort()).toEqual(PINNED);
  });
});

const PINNED = [
  'babies', "babies'", "babies's", "baby's",
  "boy's", 'boys', "boys'", "boys's",
  "child's", 'children', "children's", "childrens'",
  "dog's", 'dogs', "dogs'", "dogs's",
  "fox's", 'foxes', "foxes'", "foxes's",
  "girl's", 'girls', "girls'", "girls's",
  "horse's", 'horses', "horses'", "horses's",
  "man's", 'men', "men's", "mens'",
  'mice', "mice's", "mices'", "mouse's",
  'people', "people's", "peoples'", "person's",
  "teacher's", 'teachers', "teachers'", "teachers's",
  "woman's", 'women', "women's", "womens'",
];

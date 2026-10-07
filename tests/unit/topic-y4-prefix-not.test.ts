import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID, GAP_WORDS } from '../../src/curriculum/util';
import { REAL_LOOKALIKES } from '../../src/curriculum/spelling-rules';
import { PREFIX_NOT_ROOTS } from '../../src/curriculum/year4-prefix-not';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y4-prefix-not')!;
const draws = (d: Difficulty, n = 400) => { const r = rng(1158 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
// Gap-spelling AVOID does not list every crude whole word (G13): a short local set too.
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];
const bad = (s: string) => [...AVOID, ...EXCLUDE].some(a => s.toLowerCase().includes(a));
// The test's own rule, independent of the bank: l → il, m or p → im, r → ir, otherwise in.
const rule = (root: string) => (root[0] === 'l' ? 'il' : root[0] === 'm' || root[0] === 'p' ? 'im' : root[0] === 'r' ? 'ir' : 'in');
const rootOf = (prompt: string) => /opposite of (\w+)\?$/.exec(prompt)![1];
// Real words that a "not" decoy could be; the d3 inventory is checked against them.
const REAL = new Set(['inpatient', 'inactive', 'incorrect', 'indirect', 'inform', 'inlet']);

describe('y4-prefix-not (#1158)', () => {
  it('is registered once in Year 4 spelling', () => {
    expect(TOPICS.filter(t => t.id === 'y4-prefix-not')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year4', subject: 'writing', strand: 'spelling' });
  });

  it('the oracle agrees with the bank for every root, and all four prefixes are covered', () => {
    for (const [root, prefix] of PREFIX_NOT_ROOTS) expect(prefix, root).toBe(rule(root));
    for (const p of ['in', 'il', 'im', 'ir']) expect(PREFIX_NOT_ROOTS.filter(r => r[1] === p).length, p).toBeGreaterThanOrEqual(3);
  });

  it('d1: in- and im- roots only, 3 prefix bubbles, answer by the rule, root shown on a word visual', () => {
    const answers = new Set<string>();
    for (const c of draws(1)) {
      answers.add(c.answer);
      const root = rootOf(c.prompt);
      expect(c.answer).toBe(rule(root));
      expect(['in', 'im']).toContain(c.answer);
      expect(c.options).toHaveLength(3);
      expect(c.visual).toEqual({ type: 'word', text: root });
      expect(c.say).toBe(c.prompt);
      if (c.answer === 'im') expect(c.options).toContain('in');
    }
    expect([...answers].sort()).toEqual(['im', 'in']);
  });

  it('d2: all four rules appear, 4 bubbles, and every il/im/ir card offers in', () => {
    const seen = new Set<string>();
    for (const c of draws(2)) {
      const root = rootOf(c.prompt);
      expect(c.answer).toBe(rule(root));
      expect([...c.options].sort()).toEqual(['il', 'im', 'in', 'ir']);
      seen.add(c.answer);
    }
    expect([...seen].sort()).toEqual(['il', 'im', 'in', 'ir']);
  });

  it('d3: the whole word, wide, at most 9 letters, decoys are the other prefixes on the same root', () => {
    for (const c of draws(3)) {
      const root = /not (\w+)\?$/.exec(c.prompt)![1];
      expect(c.answer).toBe(rule(root) + root);
      expect(c.wide).toBe(true);
      expect(c.say).toBe(c.prompt);
      expect(c.options).toHaveLength(4);
      for (const o of c.options) { expect(o.length, o).toBeLessThanOrEqual(9); expect(o.endsWith(root), o).toBe(true); }
    }
  });

  it('d3 option inventory is pinned', () => {
    const all = [...new Set(draws(3, 3000).flatMap(c => c.options))].sort();
    expect(all).toEqual(PINNED_D3);
  });

  it('d3 decoys are non-words: not real look-alikes, gap words or crude, and patient is not a d3 root', () => {
    for (const c of draws(3)) {
      for (const o of c.options) {
        expect(bad(o), o).toBe(false);
        if (o === c.answer) continue;
        expect(REAL.has(o) || REAL_LOOKALIKES.has(o) || GAP_WORDS.has(o), o).toBe(false);
      }
      expect(c.answer).not.toBe('impatient');
    }
  });

  it('no bank root or sentence is crude', () => {
    for (const [root, prefix] of PREFIX_NOT_ROOTS) { expect(bad(root), root).toBe(false); expect(bad(prefix + root), root).toBe(false); }
  });
});

// Filled from the generator's own output the first time it ran green and then read by eye (#418 method).
const PINNED_D3: string[] = [
  'ilactive', 'ilcorrect', 'ildirect', 'iledible', 'ilformal', 'illegal',
  'illegible', 'illogical', 'ilmature', 'ilmobile', 'ilmortal', 'ilperfect',
  'ilpolite', 'ilpure', 'ilregular', 'ilsecure', 'ilvisible', 'imactive',
  'imcorrect', 'imdirect', 'imedible', 'imformal', 'imlegal', 'imlegible',
  'imlogical', 'immature', 'immobile', 'immortal', 'imperfect', 'impolite',
  'impure', 'imregular', 'imsecure', 'imvisible', 'inactive', 'incorrect',
  'indirect', 'inedible', 'informal', 'inlegal', 'inlegible', 'inlogical',
  'inmature', 'inmobile', 'inmortal', 'inperfect', 'inpolite', 'inpure',
  'inregular', 'insecure', 'invisible', 'iractive', 'ircorrect', 'irdirect',
  'iredible', 'irformal', 'irlegal', 'irlegible', 'irlogical', 'irmature',
  'irmobile', 'irmortal', 'irperfect', 'irpolite', 'irpure', 'irregular',
  'irsecure', 'irvisible',
];

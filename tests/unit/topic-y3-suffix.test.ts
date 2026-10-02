import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { SUFFIX_BANK } from '../../src/curriculum/year3-suffix';
import type { SuffixRule } from '../../src/curriculum/year3-suffix';
import { rLblProblem } from './helpers/r-lbl';

// Deterministic RNG (mulberry32), same construction the other topic tests use.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y3-suffix')!;
const DRAWS = 600;
const draws = (d: Difficulty) => { const r = rng(1104_000 + d); return Array.from({ length: DRAWS }, () => topic.gen(d, r)); };

/** Independent oracle: the spelling each Appendix 1 rule (p.12–13) computes, never trusted from the table. */
function spell(root: string, rule: SuffixRule): string {
  switch (rule) {
    case 'plain': return `${root}ly`;
    case 'y-to-i': return `${root.slice(0, -1)}ily`;
    case 'le': return `${root.slice(0, -2)}ly`;
    case 'ic': return `${root}ally`;
    case 'listed': return { true: 'truly', due: 'duly', whole: 'wholly' }[root]!;
    case 'ation': return `${root.replace(/e$/, '')}ation`;
  }
}
/** Real words a decoy must never be (homophones and near-spellings that exist), plus words a card should not show. */
const REAL_LOOKALIKES = new Set(['holy', 'dully', 'publicly', 'wholy', 'tragedy', 'truth', 'duty']);
const EXCLUDE = new Set(['gay', 'queer', 'bitch', 'butt']);

describe('y3-suffix (#1104)', () => {
  it('is registered once, in Year 3, as writing', () => {
    expect(TOPICS.filter(t => t.id === 'y3-suffix')).toHaveLength(1);
    expect(topic.year).toBe('year3');
    expect(topic.subject).toBe('writing');
  });

  it('the oracle recomputes every row, and every rule has at least 3 rows', () => {
    for (const [root, suf, ans, rule] of SUFFIX_BANK) {
      expect(ans, `${root} + ${suf}`).toBe(spell(root, rule));
      expect(suf === 'ation', root).toBe(rule === 'ation');
      if (rule === 'y-to-i') expect(root).toMatch(/[^aeiou]y$/);
      if (rule === 'le') expect(root).toMatch(/le$/);
      if (rule === 'ic') expect(root).toMatch(/ic$/);
    }
    for (const rule of ['plain', 'y-to-i', 'le', 'ic', 'listed', 'ation'] as const)
      expect(SUFFIX_BANK.filter(r => r[3] === rule).length, rule).toBeGreaterThanOrEqual(3);
  });

  it('decoys differ from the answer and each other, are not real words, and are never another row\'s answer', () => {
    const answers = new Set(SUFFIX_BANK.map(r => r[2]));
    for (const [root, , ans, , a, b] of SUFFIX_BANK) {
      expect(new Set([ans, a, b]).size, root).toBe(3);
      for (const x of [a, b]) {
        expect(REAL_LOOKALIKES.has(x), x).toBe(false);
        expect(answers.has(x), x).toBe(false);
        expect([...AVOID].some(w => x.includes(w)), x).toBe(false);
      }
      expect(AVOID.has(ans) || EXCLUDE.has(root) || EXCLUDE.has(ans), ans).toBe(false);
    }
  });

  it('every question has the answer once among 3 options, and the sum is named in the prompt', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) {
      expect(c.options, c.prompt).toHaveLength(3);
      expect(c.options.filter(o => o === c.answer), c.prompt).toHaveLength(1);
      expect(c.say, c.prompt).toMatch(/^Add (ly|ation) to \w+\. Which spelling is right\?$/);
      const row = SUFFIX_BANK.find(r => r[2] === c.answer)!;
      expect(c.say).toContain(`${row[1]} to ${row[0]}`);
      expect(c.prompt).toContain(`${row[0]} + ${row[1]}`);
      expect([...c.options].sort(), c.prompt).toEqual([row[2], row[4], row[5]].sort());
    }
  });

  it('d1 asks only plain -ly, d2 only the exceptions and -ation, d3 mixes every rule in a gapped sentence', () => {
    const rule = (a: string) => SUFFIX_BANK.find(r => r[2] === a)![3];
    const rulesSeen = (d: Difficulty) => {
      const set = new Set<string>();
      for (const c of draws(d)) { set.add(rule(c.answer)); expect(c.visual?.type).toBe('word'); }
      return [...set].sort();
    };
    expect(rulesSeen(1)).toEqual(['plain']);
    expect(rulesSeen(2)).toEqual(['ation', 'ic', 'le', 'listed', 'y-to-i']);
    const seen = new Set<string>();
    for (const c of draws(3)) {
      seen.add(rule(c.answer));
      expect(c.visual?.type).toBe('sentence');
      expect(c.visual && 'text' in c.visual ? c.visual.text : '').toContain('___');
    }
    expect([...seen].sort()).toEqual(['ation', 'ic', 'le', 'listed', 'plain', 'y-to-i']);
  });

  it('every label passes R-LBL', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) expect(rLblProblem(c), c.answer).toBeNull();
  });
});

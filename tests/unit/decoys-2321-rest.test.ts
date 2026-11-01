import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { Y34_HOMOPHONE_SETS_1 } from '../../src/curriculum/year3-homophones';
import { DECOYS } from '../../src/curriculum/year5-relative';
import { OPS } from '../../src/curriculum/year4-whichop';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = (id: string) => TOPICS.find(x => x.id === id)!;
const N = 200;
const DIFFS: Difficulty[] = [1, 2, 3];
const each = (id: string, ds: Difficulty[], fn: (q: ReturnType<typeof topic>['gen'] extends (...a: never[]) => infer Q ? Q : never, d: Difficulty) => void) => {
  for (const d of ds) { const r = rng(2321 * 10 + d); for (let i = 0; i < N; i++) fn(topic(id).gen(d, r), d); }
};

describe('#2321 remaining decoy rules hold over 200 seeds per difficulty', () => {
  it('y3-homophones: the options are exactly the answer’s own homophone set', () => {
    each('y3-homophones', DIFFS, q => {
      const set = Y34_HOMOPHONE_SETS_1.find(s => s.includes(q.answer.toLowerCase()))!;
      expect([...q.options].map(o => o.toLowerCase()).sort(), q.prompt).toEqual([...set].sort());
    });
  });

  it('y5-relative d2: decoys come from the answer’s own list and never include "that"', () => {
    each('y5-relative', [2], q => {
      for (const o of q.options.filter(x => x !== q.answer)) {
        expect(DECOYS[q.answer], `${q.prompt}: ${o}`).toContain(o);
        expect(o).not.toBe('that');
      }
    });
  });

  it('y6-subjectobject: every option is a word of the sentence itself', () => {
    each('y6-subjectobject', DIFFS, q => {
      const sentence = (q.visual as { text: string }).text;
      const words = sentence.replace(/[?.!]$/, '').split(' ');
      for (const o of q.options) expect(words, `${sentence}: ${o}`).toContain(o);
    });
  });

  it('y4-whichop: the four operations are always the options, so a decoy is always an operation', () => {
    each('y4-whichop', DIFFS, q => { expect([...q.options].sort()).toEqual([...OPS].sort()); });
  });

  it('y6-consistency d1: the decoy is the other form of the same verb', () => {
    each('y6-consistency', [1], q => {
      const decoys = q.options.filter(o => o !== q.answer);
      expect(decoys.length).toBeGreaterThan(0);
      for (const o of decoys) expect(['is', 'are', 'has', 'have', 'am'], `${q.prompt}: ${o}`).toContain(o);
    });
  });
});

// #2318 (statutory word lists): every dictation card says its word in the order it is built.
// Every entry and form of all four lists is checked (no sampling), and the spoken form must not say "minus".
import { describe, expect, it } from 'vitest';
import { wordListQ } from '../../src/curriculum/spelling-ks2';
import type { Difficulty } from '../../src/curriculum';
import { symSay } from '../../src/curriculum/util';
import { Y3_WORDLIST } from '../../src/curriculum/wordlist-y3';
import { Y4_WORDLIST } from '../../src/curriculum/wordlist-y4';
import { Y5_WORDLIST } from '../../src/curriculum/year5-wordlist';
import { Y6_WORDLIST } from '../../src/curriculum/wordlist-y6';

describe.each([['y3', Y3_WORDLIST], ['y4', Y4_WORDLIST], ['y5', Y5_WORDLIST], ['y6', Y6_WORDLIST]] as const)('%s word list says why (#2318)', (_id, list) => {
  it('every form gets a letters or parts why that joins back to its word, with no "minus" when spoken', () => {
    for (const entry of list) for (const form of entry.forms) for (const d of [1, 2, 3] as Difficulty[]) {
      let n = 0;
      const rng = () => { const v = (entry.forms.indexOf(form) + 0.5) / entry.forms.length; n++; return v; };
      const q = wordListQ(rng, { printed: entry.printed, forms: [form] }, d);
      const m = q.why!.match(/^(Letters|Parts) in order: (.+)$/);
      expect(m, q.why).not.toBeNull();
      const bits = m![2].split(', ');
      expect(m![1], form.w).toBe(form.chunks ? 'Parts' : 'Letters');
      expect(bits.join(''), form.w).toBe(form.w);
      expect(bits.length, q.why).toBe(form.chunks ? form.chunks.length : form.w.length);
      expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(14);   // the why.test.ts rail counts words, not letters
      expect(symSay(q.why!), q.why).not.toMatch(/minus/);
    }
  });
});

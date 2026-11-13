// #2318 (y3-prefix, y3-suffix): the why gives the rule or the meaning, never the bare answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { suffixWhy, SUFFIX_BANK } from '../../src/curriculum/year3-suffix';
import { prefixWhy } from '../../src/curriculum/year3-prefix';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (id: string) => ([1, 2, 3] as Difficulty[]).flatMap(d => Array.from({ length: 200 }, (_, n) => TOPICS.find(x => x.id === id)!.gen(d, rngOf((n + 1) * 104729 + d))));

describe('y3-suffix says why (#2318)', () => {
  it('names the rule for each kind of word', () => {
    expect(suffixWhy('sad', 'sadly', 'plain')).toBe('Just add -ly to the end: sad + ly = sadly.');
    expect(suffixWhy('happy', 'happily', 'y-to-i')).toContain('Change y to i');
    expect(suffixWhy('gentle', 'gently', 'le')).toBe('Change -le to -ly: gentle → gently.');
    expect(suffixWhy('basic', 'basically', 'ic')).toContain('-ally');
    expect(suffixWhy('true', 'truly', 'listed')).toContain('exception');
    expect(suffixWhy('adore', 'adoration', 'ation')).toContain('Drop the e');
    expect(suffixWhy('relax', 'relaxation', 'ation')).not.toContain('Drop');
  });
  it('every question carries the rule of the row its answer is in', () => {
    for (const q of draws('y3-suffix')) {
      const r = SUFFIX_BANK.find(x => x[2] === q.answer)!;
      expect(q.why).toBe(suffixWhy(r[0], r[2], r[3]));
      expect(q.why).not.toBe(q.answer);
      expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(14);
      if (r[3] === 'plain') expect(r[1]).toBe('ly');
    }
  });
});

describe('y3-prefix says why (#2318)', () => {
  it('builds the word from the prefix and root', () => expect(prefixWhy('re', 'write', 'write again')).toBe('re- + write = write again.'));
  it('every question has a why that is not the bare answer', () => {
    for (const q of draws('y3-prefix')) { expect(q.why).toBeTruthy(); expect(q.why).not.toBe(q.answer); expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(14); }
    for (const q of draws('y3-prefix').filter(x => x.prompt.startsWith('Which prefix'))) expect(q.why).toMatch(new RegExp(`^${q.answer}- means .+, as in ${q.answer}`));
  });
});

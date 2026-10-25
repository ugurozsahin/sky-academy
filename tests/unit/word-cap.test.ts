import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { wideFor } from '../../src/curriculum/util';
import { capWordBubbles, hintOnce, waveOptsFor, WORD_CAP_YEARS, MAX_WORD_BUBBLES_KS1 } from '../../src/ui/wave-opts';

// #2315: Reception to Year 2 word games launch at most three word bubbles a wave.
function rngFor(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const DIFFS: Difficulty[] = [1, 2, 3];

describe('capWordBubbles (#2315)', () => {
  it('trims a four-word set to three and keeps the answer, wherever it sits', () => {
    for (const ans of ['one', 'two', 'three', 'four']) {
      const out = capWordBubbles(['one', 'two', 'three', 'four'], ans);
      expect(out).toHaveLength(MAX_WORD_BUBBLES_KS1); expect(out).toContain(ans);
    }
  });
  it('leaves number sets and sets of three or fewer alone', () => {
    expect(capWordBubbles(['1', '2', '3', '4'], '2')).toEqual(['1', '2', '3', '4']);
    expect(capWordBubbles(['cat', 'dog', 'hen'], 'cat')).toEqual(['cat', 'dog', 'hen']);
  });
  it('applies to Reception, Year 1 and Year 2 only', () => { expect([...WORD_CAP_YEARS].sort()).toEqual(['reception', 'year1', 'year2']); });
});

describe('Reception to Year 2 waves carry at most three word bubbles (#2315)', () => {
  const topics = TOPICS.filter(t => WORD_CAP_YEARS.has(t.year));
  it('over 200 seeds per difficulty, every topic', () => {
    let capped = 0;
    for (const t of topics) for (const d of DIFFS) for (let s = 0; s < 200; s++) {
      const q = t.gen(d, rngFor(s * 7 + d));
      const w = waveOptsFor(q, { labels: q.options, speed: 1 }, undefined, false, undefined, true);
      if (q.sequence) { expect(w.labels, `${t.id} sequence untouched`).toEqual(q.options); continue; }
      expect(w.labels, `${t.id} keeps the answer`).toContain(q.answer);
      if (wideFor(w.labels)) expect(w.labels.length, `${t.id} d${d} seed ${s}`).toBeLessThanOrEqual(MAX_WORD_BUBBLES_KS1);
      if (!wideFor(q.options)) expect(w.labels, `${t.id} numbers untouched`).toEqual(q.options);
      if (w.labels.length < q.options.length) capped++;
    }
    expect(capped, 'the cap actually bites somewhere').toBeGreaterThan(0);
  });
  it('Years 3 to 6 are not capped', () => {
    for (const t of TOPICS.filter(t => !WORD_CAP_YEARS.has(t.year)).slice(0, 40)) {
      const q = t.gen(2, rngFor(3));
      expect(waveOptsFor(q, { labels: q.options, speed: 1 }, undefined, false, undefined, WORD_CAP_YEARS.has(t.year)).labels).toEqual(q.options);
    }
  });
});

describe('hintOnce: the fixed instruction shows before wave 1 only (#2315)', () => {
  const word = { prompt: 'p', answer: 'ous', options: ['ous', 'ious', 'eous'] };
  const num = { prompt: 'p', answer: '4', options: ['4', '5', '3'] };
  it('shows a Year 1 word game’s instruction once, then returns nothing', () => {
    const st = { shownHint: null as string | null };
    expect(hintOnce('year1', word, 'Slice the ending', st)).toBe('Slice the ending');
    expect(hintOnce('year1', word, 'Slice the ending', st)).toBe('');
    expect(hintOnce('year1', word, 'Slice the ending', st)).toBe('');
  });
  it('a changed instruction is a new one and shows', () => {
    const st = { shownHint: null as string | null };
    hintOnce('year2', word, 'Slice the ending', st);
    expect(hintOnce('year2', word, 'Slice the beginning', st)).toBe('Slice the beginning');
  });
  it('keeps number games, data hints, sequences and Years 3 to 6 on every wave', () => {
    const st = { shownHint: 'x' };
    expect(hintOnce('year1', num, 'x', st)).toBe('x');
    expect(hintOnce('year1', { ...word, hint: 'x', hintIsData: true }, 'x', st)).toBe('x');
    expect(hintOnce('year1', { ...word, sequence: ['a'] }, 'x', st)).toBe('x');
    expect(hintOnce('year4', word, 'x', st)).toBe('x');
  });
});

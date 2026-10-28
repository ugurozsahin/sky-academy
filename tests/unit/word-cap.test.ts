import { describe, it, expect } from 'vitest';
import { TOPICS, YEARS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { capApplies, isWordSet, capWordBubbles, hintOnce, waveOptsFor, WORD_CAP_YEARS, MAX_WORD_BUBBLES_KS1 } from '../../src/ui/wave-opts';

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
  it('applies to Reception, Year 1 and Year 2 only, and those ids are real years', () => {
    expect([...WORD_CAP_YEARS].sort()).toEqual(['reception', 'year1', 'year2']);
    expect(YEARS.filter(y => WORD_CAP_YEARS.has(y.id)).map(y => y.id)).toEqual(['reception', 'year1', 'year2']);
  });
  it('keeps the survivors in their order and the card wide', () => {
    expect(capWordBubbles(['one', 'two', 'three', 'four'], 'two')).toEqual(['one', 'two', 'three']);
    expect(capWordBubbles(['one', 'two', 'three', 'four'], 'four')).toEqual(['one', 'two', 'four']);
    const q = { prompt: 'p', answer: 'four', options: ['one', 'two', 'three', 'four'] };
    expect(waveOptsFor(q, { labels: q.options, speed: 1 }, undefined, false, undefined, true).wide).toBe(true);
  });
  it('only plain word sets are capped: numbers, money, time and measures are left alone (#2315 review 5)', () => {
    for (const set of [['100', '120', '130', '140'], ['10p', '20p', '5p', '50p'], ['£1.50', '£2', '£1', '£5'], ['3:30', '4:30', '3:00', '12:00'], ['12 cm', '10 cm', '5 cm', '20 cm']]) {
      expect(isWordSet(set), set.join()).toBe(false);
      expect(capWordBubbles(set, set[0]), set.join()).toEqual(set);
    }
    expect(isWordSet(['ice cream', "can't", 'well-known', 'cat'])).toBe(true);
  });
  it('a sequence or an options-are-content question is never capped (#2315 review 6)', () => {
    const base = { prompt: 'p', answer: 'one', options: ['one', 'two', 'three', 'four'] };
    expect(capApplies(base, base.options)).toBe(true);
    expect(capApplies({ ...base, sequence: ['one'] }, base.options)).toBe(false);
    expect(capApplies({ ...base, optionsAreContent: true }, base.options)).toBe(false);
    expect(waveOptsFor({ ...base, optionsAreContent: true }, { labels: base.options, speed: 1 }, undefined, false, undefined, true).labels).toEqual(base.options);
  });
  it('the cap and the hint share one predicate, so a capped wave and a quiet hint agree', () => {
    const q = { prompt: 'p', answer: 'one', options: ['one', 'two', 'three', 'four'] };
    expect(hintOnce('year1', q, 'x', { shownHint: { line: 'x', q: { ...q } } })).toBe('');
    const money = { prompt: 'p', answer: '10p', options: ['10p', '20p', '5p', '50p'] };
    expect(hintOnce('year1', money, 'x', { shownHint: { line: 'x', q: { ...money } } })).toBe('x');
  });
  it('the bomb a villain game adds after the cap is intended: a capped wave can carry four bubbles (play-session.ts launchWave)', () => {
    expect(capWordBubbles(['one', 'two', 'three', 'four'], 'one').length + 1).toBe(MAX_WORD_BUBBLES_KS1 + 1);
  });
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
      if (capApplies(q, q.options)) expect(w.labels.length, `${t.id} d${d} seed ${s}`).toBeLessThanOrEqual(MAX_WORD_BUBBLES_KS1);
      if (!capApplies(q, q.options)) expect(w.labels, `${t.id} not a plain word set: untouched`).toEqual(q.options);
      if (w.labels.length < q.options.length) capped++;
    }
    expect(capped, 'the cap actually bites somewhere').toBeGreaterThan(0);
  });
  it('the topics whose lettered four-option sets the cap exempts are exactly this list (#2378)', () => {
    const exempt = new Set<string>();
    for (const t of topics) for (const d of DIFFS) for (let s = 0; s < 200; s++) {
      const q = t.gen(d, rngFor(s * 7 + d));
      if (q.options.length > MAX_WORD_BUBBLES_KS1 && !capApplies(q, q.options) && !q.sequence && !q.optionsAreContent && q.options.some(o => /[A-Za-z]/.test(o))) exempt.add(t.id);
    }
    // Sounds, tricky words, units, times and money: letters, but not a plain word set. A new word game that slips past isWordSet shows up here.
    expect([...exempt].sort()).toEqual([
      'r-capitals', 'r-soundhunt', 'r-sounds', 'r-tricky', 'y1-alphabet', 'y1-coins', 'y1-days', 'y1-digraphs', 'y1-soundhunt', 'y1-time',
      'y2-capacity', 'y2-coincombo', 'y2-duration', 'y2-length', 'y2-mass', 'y2-money', 'y2-scales', 'y2-spelling', 'y2-story-add',
      'y2-story-money', 'y2-symmetry', 'y2-temp', 'y2-time',
    ]);
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
    const st = { shownHint: null as { line: string; q: typeof word } | null };
    expect(hintOnce('year1', word, 'Slice the ending', st)).toBe('Slice the ending');
    expect(hintOnce('year1', { ...word }, 'Slice the ending', st)).toBe('');
    expect(hintOnce('year1', { ...word }, 'Slice the ending', st)).toBe('');
  });
  it('a re-render of the question that showed it keeps the line (voice change, respawn)', () => {
    const st = { shownHint: null as { line: string; q: typeof word } | null };
    expect(hintOnce('year1', word, 'Slice the ending', st)).toBe('Slice the ending');
    expect(hintOnce('year1', word, 'Slice the ending', st)).toBe('Slice the ending');
    const second = { ...word };
    expect(hintOnce('year1', second, 'Slice the ending', st)).toBe('');
    expect(hintOnce('year1', second, 'Slice the ending', st)).toBe('');
    expect(hintOnce('year1', word, 'Slice the ending', st), 'wave 1 again after wave 2 is still its own').toBe('Slice the ending');
  });
  it('a changed instruction is a new one and shows', () => {
    const st = { shownHint: null as { line: string; q: typeof word } | null };
    hintOnce('year2', word, 'Slice the ending', st);
    const other = { ...word };
    expect(hintOnce('year2', other, 'Slice the beginning', st), 'a different question object with a different line').toBe('Slice the beginning');
  });
  it('keeps number games, data hints, sequences and Years 3 to 6 on every wave', () => {
    const st = { shownHint: { line: 'x', q: num } };
    expect(hintOnce('year1', num, 'x', st)).toBe('x');
    expect(hintOnce('year1', { ...word, hint: 'x', hintIsData: true }, 'x', st)).toBe('x');
    expect(hintOnce('year1', { ...word, sequence: ['a'] }, 'x', st)).toBe('x');
    expect(hintOnce(YEARS[4].id, word, 'x', st)).toBe('x');
  });
});

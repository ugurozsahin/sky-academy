import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { AGREE_PLAIN, AGREE_TRAP, TENSE_PLAIN, TENSE_LATE } from '../../src/curriculum/year6-consistency';
import { rLblProblem } from './helpers/r-lbl';
import { cardBudgetProblem } from './helpers/card-budget';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-consistency')!;
const draws = (d: Difficulty, n = 300) => { const r = rng(1285 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };

// Literals of the test, not the module (#666): the answers are re-derived from these, never from a tag on the row.
const IRREGULAR_PLURALS = ['children', 'people', 'mice', 'men', 'women', 'feet', 'teeth', 'geese'];
const VERB_NUMBER: Record<string, 'singular' | 'plural'> = { is: 'singular', has: 'singular', was: 'singular', are: 'plural', have: 'plural', were: 'plural' };
const EXCLUDED = ['team', 'family', 'class', 'group', 'crowd', 'none', 'neither'];
const DETERMINERS = ['the', 'my', 'these', 'this', 'our'];
const TIME_ANCHORS: Record<string, 'past' | 'future' | 'present'> = {
  yesterday: 'past', 'last week': 'past', 'last night': 'past', ago: 'past',
  tomorrow: 'future', 'next week': 'future', soon: 'future',
  nowadays: 'present',
};
const ANCHOR_VERBS: Record<string, 'past' | 'future'> = { went: 'past', came: 'past', was: 'past', were: 'past', arrived: 'past', will: 'future' };
const FORMS: Record<string, { past: string; present: string[]; future: string; would: string }> = {
  play: { past: 'played', present: ['play', 'plays'], future: 'will play', would: 'would play' },
  wash: { past: 'washed', present: ['wash', 'washes'], future: 'will wash', would: 'would wash' },
  walk: { past: 'walked', present: ['walk', 'walks'], future: 'will walk', would: 'would walk' },
  visit: { past: 'visited', present: ['visit', 'visits'], future: 'will visit', would: 'would visit' },
  clean: { past: 'cleaned', present: ['clean', 'cleans'], future: 'will clean', would: 'would clean' },
  help: { past: 'helped', present: ['help', 'helps'], future: 'will help', would: 'would help' },
  cook: { past: 'cooked', present: ['cook', 'cooks'], future: 'will cook', would: 'would cook' },
  watch: { past: 'watched', present: ['watch', 'watches'], future: 'will watch', would: 'would watch' },
};

const FIRST_PERSON = ['i', 'we', 'you', 'they'];
const wordsOf = (s: string) => s.toLowerCase().match(/[a-z]+/g)!;
const numberOf = (noun: string): 'singular' | 'plural' => IRREGULAR_PLURALS.includes(noun) || noun.endsWith('s') ? 'plural' : 'singular';
const head = (s: string): 'singular' | 'plural' => {
  const w = wordsOf(s);
  if (w[0] === 'each' && w[1] === 'of') return 'singular';
  expect(DETERMINERS, s).toContain(w[0]);
  expect(EXCLUDED, s).not.toContain(w[1]);
  return numberOf(w[1]);
};
const nearest = (s: string) => numberOf(wordsOf(s.split('_')[0]).pop()!);
const anchorsOf = (s: string) => {
  const lower = ' ' + wordsOf(s).join(' ') + ' ';
  const tenses = [
    ...Object.entries(TIME_ANCHORS).filter(([k]) => lower.includes(` ${k} `)).map(([, t]) => t),
    ...Object.entries(ANCHOR_VERBS).filter(([k]) => lower.includes(` ${k} `)).map(([, t]) => t),
  ];
  return tenses;
};
const verbOf = (answer: string) => Object.entries(FORMS).find(([, f]) => [f.past, f.future, ...f.present].includes(answer))![1];

describe('y6-consistency (#1285)', () => {
  it('is registered once in Year 6 writing, in the grammar strand', () => {
    expect(TOPICS.filter(t => t.id === 'y6-consistency')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year6', subject: 'writing', strand: 'grammar' });
  });

  it('banks: AGREE 16–20 rows and TENSE 14–18 rows, no sentence twice', () => {
    const agree = [...AGREE_PLAIN, ...AGREE_TRAP], tense = [...TENSE_PLAIN, ...TENSE_LATE];
    expect(agree.length).toBeGreaterThanOrEqual(16); expect(agree.length).toBeLessThanOrEqual(20);
    expect(tense.length).toBeGreaterThanOrEqual(14); expect(tense.length).toBeLessThanOrEqual(18);
    const all = [...agree, ...tense].map(r => r[0]);
    expect(new Set(all).size).toBe(all.length);
  });

  it('AGREE: the answer agrees with the head noun’s computed number, the other form does not', () => {
    for (const [s, answer, other] of [...AGREE_PLAIN, ...AGREE_TRAP]) {
      expect(s.match(/_/g), s).toHaveLength(1);
      expect(VERB_NUMBER[answer], s).toBe(head(s));
      expect(VERB_NUMBER[other], s).not.toBe(head(s));
    }
  });

  it('the number rules can fail: they tell a plural from a singular, and the bank holds both kinds of head', () => {
    expect([numberOf('children'), numberOf('feet'), numberOf('dogs'), numberOf('dog'), numberOf('box')]).toEqual(['plural', 'plural', 'plural', 'singular', 'singular']);
    const heads = [...AGREE_PLAIN, ...AGREE_TRAP].map(r => head(r[0]));
    expect(heads.filter(h => h === 'plural').length).toBeGreaterThanOrEqual(4);
    expect(heads.filter(h => h === 'singular').length).toBeGreaterThanOrEqual(4);
    expect([...AGREE_PLAIN, ...AGREE_TRAP].filter(r => wordsOf(r[0])[0] === 'each').length).toBeGreaterThanOrEqual(3);
    expect([...AGREE_PLAIN, ...AGREE_TRAP].some(r => IRREGULAR_PLURALS.includes(wordsOf(r[0])[1]))).toBe(true);
  });

  it('AGREE: no singular head noun ends in -s, and "Each of" rows are singular', () => {
    for (const [s] of [...AGREE_PLAIN, ...AGREE_TRAP]) {
      const w = wordsOf(s);
      if (w[0] === 'each') expect(head(s)).toBe('singular');
      else if (head(s) === 'singular') expect(w[1].endsWith('s'), s).toBe(false);
    }
  });

  it('AGREE trap rows: the decoy agrees with the nearest noun and the nearest noun is not the head', () => {
    for (const [s, , other] of AGREE_TRAP) {
      expect(VERB_NUMBER[other], s).toBe(nearest(s));
      expect(nearest(s), s).not.toBe(head(s));
    }
    for (const [s] of AGREE_PLAIN) expect(wordsOf(s.split('_')[0]), s).toHaveLength(2);
  });

  it('TENSE: anchors exist, share one tense, and the answer is that tense’s form of the verb', () => {
    for (const [s, answer, others] of [...TENSE_PLAIN, ...TENSE_LATE]) {
      expect(s.match(/_/g), s).toHaveLength(1);
      const tenses = anchorsOf(s);
      expect(tenses.length, s).toBeGreaterThan(0);
      expect(new Set(tenses).size, s).toBe(1);
      const f = verbOf(answer);
      const right = tenses[0] === 'present' ? f.present : [f[tenses[0] as 'past' | 'future']];
      expect(right, s).toContain(answer);
      if (tenses[0] === 'future') {
        // the present simple also names a plan, so a future row never offers it as a decoy (#1285 review)
        expect(wordsOf(s.split('_')[0]).filter(w => FIRST_PERSON.includes(w)), s).toEqual([]);
        expect([answer, ...others].sort(), s).toEqual([f.past, f.present[0], f.future, f.would].sort());
        f.present.slice(1).forEach(p => expect(others, s).not.toContain(p));
      } else {
        expect([answer, ...others].sort(), s).toEqual([f.past, ...f.present, f.future].sort());
        if (tenses[0] === 'present') {
          // the subject pins the present form: I / we / you / they take the base, anyone else the -s form (#1285 review)
          const subject = wordsOf(s.split('_')[0]).pop()!;
          expect(answer, s).toBe(FIRST_PERSON.includes(subject) ? f.present[0] : f.present[1]);
        }
      }
    }
  });

  it('TENSE late rows put the anchor verb after the blank; plain rows have a time word', () => {
    for (const [s] of TENSE_LATE) {
      const after = ' ' + wordsOf(s.split('_')[1]).join(' ') + ' ';
      expect(Object.keys(ANCHOR_VERBS).some(k => after.includes(` ${k} `)), s).toBe(true);
    }
    for (const [s] of TENSE_PLAIN) expect(Object.keys(TIME_ANCHORS).some(k => ` ${wordsOf(s).join(' ')} `.includes(` ${k} `)), s).toBe(true);
  });

  it('no option is a perfect or progressive form', () => {
    for (const q of [...draws(1), ...draws(2), ...draws(3)]) for (const o of q.options) {
      expect(o, q.prompt).not.toMatch(/^(had|has been|have been|was|were|is|are)\s\w+ing$|ing$|^had /);
    }
  });

  it('d1: the plain verb forms, the answer agrees, "am" joins only the be cards', () => {
    for (const q of draws(1)) {
      const s = (q.visual as { text: string }).text;
      const row = AGREE_PLAIN.find(r => r[0] === s)!;
      expect(row, s).toBeDefined();
      expect(q.answer).toBe(row[1]); expect(q.options).toContain(row[2]);
      expect(VERB_NUMBER[q.answer], s).toBe(head(s));
      const be = ['is', 'are'].includes(q.answer);
      expect(q.options.length).toBe(be ? 3 : 2);
      expect(q.options.includes('am')).toBe(be);
    }
  });

  it('d2: four options, all forms of one verb, the answer is the anchored tense', () => {
    for (const q of draws(2)) {
      expect(q.options).toHaveLength(4);
      const s = (q.visual as { text: string }).text;
      const row = TENSE_PLAIN.find(r => r[0] === s)!;
      expect(row, s).toBeDefined();
      expect(q.answer).toBe(row[1]);
      expect([...q.options].sort()).toEqual([row[1], ...row[2]].sort());
    }
  });

  it('d3 mixes agreement traps and late-anchor tense cards, each 35–65 %', () => {
    const qs = draws(3);
    const tense = qs.filter(q => q.prompt.includes('tense')).length / qs.length;
    expect(tense).toBeGreaterThan(0.35); expect(tense).toBeLessThan(0.65);
    for (const q of qs.filter(q => q.prompt.includes('tense'))) {
      const s = (q.visual as { text: string }).text;
      const row = TENSE_LATE.find(r => r[0] === s)!;
      expect(row, s).toBeDefined();
      expect(q.answer).toBe(row[1]); expect([...q.options].sort()).toEqual([row[1], ...row[2]].sort());
    }
    for (const q of qs.filter(q => !q.prompt.includes('tense'))) {
      const s = (q.visual as { text: string }).text;
      const row = AGREE_TRAP.find(r => r[0] === s)!;
      expect(row, s).toBeDefined();
      expect(q.answer).toBe(row[1]);
      expect(q.options.length).toBe(2);
      expect(q.options.some(o => VERB_NUMBER[o] === nearest(s))).toBe(true);
    }
  });

  it('no sentence word or option is in AVOID; every card has a say; labels pass R-LBL and the budget', () => {
    for (const r of [...AGREE_PLAIN, ...AGREE_TRAP, ...TENSE_PLAIN, ...TENSE_LATE]) wordsOf(r[0]).forEach(w => expect(AVOID.has(w), w).toBe(false));
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      q.options.forEach(o => expect(AVOID.has(o), o).toBe(false));
      expect(q.say).toBeTruthy();
      expect(rLblProblem(q), q.options.join()).toBeNull();
      expect(cardBudgetProblem(q)).toBeNull();
    }
  });
});

import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { storyBankProblems } from '../../src/curriculum/story-bank';
import { INFER_CLUES, NOT_DECOYS, Y6_INFERENCE } from '../../src/curriculum/stories-y6';
import { TIPS, tipFor } from '../../src/game/tips';
import { mixable } from '../../src/game/pools';

const topic = TOPICS.find(t => t.id === 'y6-inference')!;
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];
const words = (s: string): string[] => s.toLowerCase().match(/[a-z']+/g) ?? [];
const clueWords = (label: string) => INFER_CLUES[label] ?? [];
const hasClue = (text: string, label: string) => words(text).some(w => clueWords(label).includes(w));
const allClues = Object.values(INFER_CLUES).flat();

describe('y6-inference (#1240)', () => {
  it('is registered once on the Year 6 writing tab as a solo reading topic', () => {
    expect(TOPICS.filter(t => t.id === 'y6-inference')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year6', subject: 'writing', strand: 'reading', solo: true, title: 'Inference' });
    expect(mixable(topic)).toBe(false);
  });

  it('the bank breaks none of the story rules, has ten passages and six questions per difficulty', () => {
    expect(storyBankProblems(Y6_INFERENCE)).toEqual([]);
    expect(new Set(Y6_INFERENCE.map(i => i.story)).size).toBe(10);
    for (const d of [1, 2, 3]) expect(Y6_INFERENCE.filter(i => i.d === d).length, `d${d}`).toBeGreaterThanOrEqual(6);
    for (const i of Y6_INFERENCE) expect(i.kind).toBe('inference');
  });

  it('no clue word sits under two labels (rule 3)', () => {
    expect(new Set(allClues).size).toBe(allClues.length);
  });

  it('d1 and d2: the evidence holds a clue of the answer and the story none of any decoy (rules 1 and 2)', () => {
    for (const i of Y6_INFERENCE.filter(x => x.d < 3)) {
      for (const l of [i.answer, ...i.decoys]) expect(INFER_CLUES, `${i.question}: ${l}`).toHaveProperty([l]);
      expect(hasClue(i.evidence, i.answer), `${i.question}: no clue of "${i.answer}" in the evidence`).toBe(true);
      for (const dec of i.decoys) expect(hasClue(i.story, dec), `${i.question}: the story supports decoy "${dec}"`).toBe(false);
    }
  });

  it('d3: the answer is a word of the passage and of its evidence, a clue of the named feeling, and no decoy is a clue', () => {
    for (const i of Y6_INFERENCE.filter(x => x.d === 3)) {
      const named = i.question.match(/was (\w+)\?$/)![1];
      expect(i.question, 'asks for the evidence word').toMatch(/^Which word shows/);
      expect(words(i.story), i.question).toContain(i.answer);
      expect(words(i.evidence), i.question).toContain(i.answer);
      expect(clueWords(named in INFER_CLUES ? named : `the ${named}`), i.question).toContain(i.answer);
      for (const dec of i.decoys) {
        expect(words(i.story), `${i.question}: decoy ${dec}`).toContain(dec.toLowerCase());
        expect(allClues, `${i.question}: decoy ${dec} is a clue`).not.toContain(dec.toLowerCase());
        // The class (round 1 review): a decoy never comes from another sentence that itself holds a clue of the named label.
        const label = named in INFER_CLUES ? named : `the ${named}`;
        const home = i.story.split(/(?<=[.!?])\s+/).find(sen => words(sen).includes(dec.toLowerCase()))!;
        expect(words(home).includes(i.answer) || !hasClue(home, label), `${i.question}: decoy ${dec} sits in a cue sentence`).toBe(true);
      }
    }
  });

  it('a label that fits by common sense is never a decoy of that item', () => {
    for (const [q, labels] of Object.entries(NOT_DECOYS)) {
      const item = Y6_INFERENCE.find(i => i.question === q);
      expect(item, q).toBeDefined();
      for (const l of labels) expect([item!.answer, ...item!.decoys], q).not.toContain(l);
    }
  });

  it('no prediction question (#666), options of at most 12 characters, nothing crude', () => {
    for (const i of Y6_INFERENCE) {
      expect(i.question, i.question).not.toMatch(/\bnext\b|will happen/i);
      for (const o of [i.answer, ...i.decoys]) expect(o.length, o).toBeLessThanOrEqual(12);
      for (const w of [i.story, i.question, i.answer, ...i.decoys].flatMap(words)) {
        expect(AVOID.has(w) || EXCLUDE.includes(w), w).toBe(false);
      }
    }
  });

  it('has a help-at-home tip', () => { expect(tipFor('y6-inference')).toBe(TIPS.comprehension); });

  it('every drawn card carries its story and the answer among the options', () => {
    for (const d of [1, 2, 3] as const) for (let n = 0; n < 40; n++) {
      const q = topic.gen(d, Math.random);
      expect(q.story).toBeTruthy();
      expect(q.options).toContain(q.answer);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { createHud } from '../../src/ui/hud';
import type { Question } from '../../src/curriculum/types';

const el = () => {
  const classes = new Set<string>();
  return {
    innerHTML: '', textContent: '', classes,
    classList: { add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c), contains: (c: string) => classes.has(c) },
  } as unknown as HTMLElement;
};

// #2314 nit: the reveal after a slice must not bring back the sentence the card already prints.
describe('the outcome reveal leaves an empty question line empty (#2314)', () => {
  const sentence = 'I ate toast ___ drank milk.';
  const q: Question = { prompt: sentence, answer: 'and', options: ['and', 'but'], visual: { type: 'sentence', text: sentence } };

  it('a card that holds the prompt keeps the question line empty on a correct and a wrong verdict', () => {
    for (const kind of ['correct', 'wrong'] as const) {
      const els = { lives: el(), qcard: el(), prompt: el(), hint: el() };
      createHud(els, 3, () => true).showOutcome(kind, q);
      expect(els.prompt.innerHTML, kind).toBe('');
    }
  });

  it('a card that differs from its question still gets the answer filled in', () => {
    const els = { lives: el(), qcard: el(), prompt: el(), hint: el() };
    createHud(els, 3, () => true).showOutcome('correct', { ...q, visual: { type: 'sentence', text: 'other' } });
    expect(els.prompt.innerHTML).toContain('<span class="ans">and</span>');
  });
});

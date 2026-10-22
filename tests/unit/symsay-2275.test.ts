import { describe, expect, it } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum/types';
import { symSay } from '../../src/curriculum/util';

describe('symSay: "?" is "what" only for a missing value (#2275)', () => {
  it.each([
    ['6 + ? = 9', '6 plus what equals 9'], ['? + 4 = 10', 'what plus 4 equals 10'], ['(3 + 2) × ?', '(3 plus 2) times what'],
    ['What is 3 + 4 = ?', 'What is 3 plus 4 equals what'], ['(? + 2) × 3', '( what plus 2) times 3'],
    ['£?', '£ what'], ['? p', 'what p'], ['?p', 'what p'], ['?%', 'what %'], ['3, ?, 7', '3, what , 7'],
    ['What comes next? 2, 4, ?', 'What comes next? 2, 4, what'],
  ])('placeholder %s', (a, b) => { expect(symSay(a)).toBe(b); });
  it.each([
    'Is this a right angle?', 'How many days in a leap year?', 'Seats left?', '29, 31, 33. What comes next?',
    'What is the missing number? 4 plus 3', 'Is 5 plus 3 equals 8?', 'What is 3 plus 4?', 'How much is 10p?',
  ])('a worded question keeps its "?": %s', (a) => { expect(symSay(a)).toBe(a); });
  it('a question ending after a sum keeps its "?"', () => { expect(symSay('What is 3 + 4?')).toBe('What is 3 plus 4?'); });
  it('a "?" mid-prompt before a sum is kept', () => { expect(symSay('What is the missing number? 4 + 3')).toBe('What is the missing number? 4 plus 3'); });
  it('Is 5 + 3 = 8? keeps its question mark', () => { expect(symSay('Is 5 + 3 = 8?')).toBe('Is 5 plus 3 equals 8?'); });
});

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
it('no topic speaks a stray "what" after a word at the end of its line, over 50 seeds (#2275)', () => {
  for (const topic of TOPICS) for (const d of [1, 2, 3] as Difficulty[]) {
    const draw = rng(d * 7919 + topic.id.length);
    for (let i = 0; i < 50; i++) {
      const spoken = topic.gen(d, draw).say ?? '';
      expect(spoken, `${topic.id} d${d}`).not.toMatch(/(?<!equals|plus|minus|times|by|and|is|to|of|from) what$/);
    }
  }
}, 60000);

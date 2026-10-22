import { describe, expect, it } from 'vitest';
import { symSay } from '../../src/curriculum/util';

describe('symSay: "?" is "what" only for a missing value (#2275)', () => {
  it.each([['6 + ? = 9', '6 plus what equals 9'], ['? + 4 = 10', 'what plus 4 equals 10'], ['(3 + 2) × ?', '3 plus 2 times what'], ['What is ? ', 'What is what']])('placeholder %s', (a, b) => {
    expect(symSay(a).replace(/[()]/g, '')).toBe(b.replace(/[()]/g, ''));
  });
  it.each(['Is this a right angle?', 'How many days in a leap year?', 'Seats left?', '29, 31, 33. What comes next?'])('a worded question keeps its "?": %s', (a) => {
    expect(symSay(a)).toBe(a);
  });
});
it('symSay: a question ending after a sum keeps its "?" (#2275)', () => { expect(symSay('What is 3 + 4?')).toBe('What is 3 plus 4?'); });

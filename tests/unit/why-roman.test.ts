// #2317 (Roman numerals): each why cuts the numeral by place value and adds the cuts, or shows a lone pair's take-away.
import { describe, expect, it, vi } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { fromRoman, romanWhy } from '../../src/curriculum/roman';

const said: string[] = [];
vi.mock('../../src/audio', async orig => ({ ...(await orig<object>()), say: (t: string) => { said.push(t); } }));
const { createHud } = await import('../../src/ui/hud');

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (id: string, d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === id)!.gen(d, rngOf((s + 1) * 104729 + d)));

describe('romanWhy (#2317)', () => {
  it('shows the cuts, the sum and the take-away', () => {
    expect(romanWhy(1999)).toBe('MCMXCIX = 1000 + 900 + 90 + 9 = 1999');
    expect(romanWhy(44)).toBe('XLIV = 40 + 4 = 44');
    expect(romanWhy(4)).toBe('IV: 5 − 1 = 4');
    expect(romanWhy(90)).toBe('XC: 100 − 10 = 90');
    expect(romanWhy(50)).toBe('L = 50');
  });
  it('is true for every value to 3999: the numeral reads back to the number the why ends in', () => {
    for (let n = 1; n <= 3999; n++) {
      const w = romanWhy(n);
      expect(Number(w.split('= ').pop()), w).toBe(n);
      expect(fromRoman(w.split(/[ :]/)[0]), w).toBe(n);
      expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(14);
    }
  });
});

describe('Roman topics set a why (#2317)', () => {
  it('every card says why, and a numeral card\'s why names the number it asks about', () => {
    for (const id of ['y3-roman', 'y4-roman', 'y5-roman']) for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(id, d)) {
      expect(q.why, `${id} ${q.prompt}`).toBeTruthy();
      const m = /^([IVXLCDM]+)(?:[ :]|$)/.exec(q.why!);
      if (m) expect(String(fromRoman(m[1])) === q.answer || m[1] === q.answer, q.why).toBe(true);
    }
  });
  it('reads a numeral in the why letter by letter, and the symbols as words', () => {
    said.length = 0;
    createHud({} as never, 3, () => true).speakCorrection({ prompt: 'x', answer: '4', options: ['4'], why: 'IV: 5 − 1 = 4' }, 'y3-roman');
    expect(said.at(-1)).toBe('I V: 5 minus 1 equals 4');
  });
});

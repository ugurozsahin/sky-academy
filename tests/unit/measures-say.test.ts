import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';

// Deterministic RNG (mulberry32), same construction curriculum.test.ts uses.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = (id: string) => TOPICS.find(x => x.id === id)!;

/**
 * #329: `measureSum` and `measureCompare` speak their question aloud (`q.say`), and a Year 2 child who cannot
 * yet read the card hears that instead. Nothing asserted it: an inverted 'plus'/'take away', a swapped closing
 * question, a wrong unit word, "the green orange" were all green. The words below are written out here, not
 * read from `UNIT_WORD` or the generators.
 */
const SAID: Record<string, string> = { cm: 'centimetres', m: 'metres', g: 'grams', kg: 'kilograms', ml: 'millilitres', l: 'litres', mm: 'millimetres' };
const CLOSING: Record<string, [string, string]> = {   // [added, subtracted]
  'y2-length': ['How long altogether?', 'How long is left?'],
  'y2-mass': ['How heavy altogether?', 'How much is left?'],
  'y2-capacity': ['How much altogether?', 'How much is left?'],
};
// Any word that names a colour. A noun in this list on a card whose bubbles are colours is a green orange.
const COLOUR_WORDS = new Set(['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'brown', 'black', 'white', 'grey', 'gray', 'gold', 'silver', 'lemon', 'plum', 'cream', 'peach', 'lime', 'olive', 'rose', 'violet', 'indigo', 'turquoise', 'coral', 'tan', 'navy', 'amber', 'cherry', 'mint']);

describe('Year 2 measures: the spoken add/subtract line (#329)', () => {
  const SUM = /^(\d+) (\S+) ([+−]) (\d+) \2 = \?$/;
  for (const id of Object.keys(CLOSING)) {
    it(`${id}: the words match the operator, the unit and the question asked`, () => {
      const t = topic(id); const r = rng(id.length + 329);
      let sums = 0, added = 0, subtracted = 0;
      for (const d of [1, 2, 3] as Difficulty[]) for (let i = 0; i < 300; i++) {
        const q = t.gen(d, r);
        if (!/ = \?$/.test(q.prompt)) continue;
        const m = q.prompt.match(SUM);
        expect(m, `"${q.prompt}" ends " = ?" but is not an add/subtract card this rail can read`).not.toBeNull();
        const [, a, unit, op, b] = m!;
        sums++; if (op === '+') added++; else subtracted++;
        const word = SAID[unit];
        const expected = op === '+'
          ? `${a} ${word} plus ${b} ${word}. ${CLOSING[id][0]}`
          : `${a} ${word} take away ${b} ${word}. ${CLOSING[id][1]}`;
        expect(q.say, q.prompt).toBe(expected);
        expect(q.say, q.prompt).not.toContain('undefined');
      }
      expect(sums, `${id} reaches the add/subtract draw`).toBeGreaterThan(100);
      expect(added, `${id} adds`).toBeGreaterThan(20);
      expect(subtracted, `${id} subtracts`).toBeGreaterThan(20);
    });
  }
});

describe('measureCompare: the spoken line agrees with the card, and no noun is a colour (#329)', () => {
  const IDS = ['y1-length', 'y1-mass', 'y1-capacity', 'y2-length', 'y2-mass', 'y2-capacity', 'y3-measures'];
  it('each "colour noun: value unit" in the hint is spoken as "the colour noun <verb> value <unit word>", and the noun is no colour', () => {
    const nouns = new Set<string>(); let rows = 0;
    for (const id of IDS) for (const d of [1, 2, 3] as Difficulty[]) {
      const t = topic(id); const r = rng(id.length * 31 + d);
      for (let i = 0; i < 400; i++) {
        const q = t.gen(d, r);
        if (!q.hint?.includes(':')) continue;
        for (const part of q.hint.split(' · ')) {
          const m = part.match(/^(\w+) ([\w ]+): (\d+) (\w+)$/);
          if (!m) continue;   // not a comparison card (a unit or temperature card carries other hints)
          const [, colour, noun, value, unit] = m;
          rows++; nouns.add(noun);
          expect(COLOUR_WORDS.has(noun), `${id}: "${colour} ${noun}" — the noun is a colour word`).toBe(false);
          expect(q.say, `${id}: ${part}`).toMatch(new RegExp(`the ${colour} ${noun} \\S+ ${value} ${SAID[unit]}\\b`));
        }
      }
    }
    expect(rows, 'comparison rows seen').toBeGreaterThan(1500);
    expect(nouns.size, 'a spread of nouns, so the rail is not vacuous').toBeGreaterThan(30);
  });
});

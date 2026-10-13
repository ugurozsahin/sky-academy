import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y1-contractions')!;
const DS: Difficulty[] = [1, 2, 3];
const ORACLE: Record<string, string> = { "I'm": 'I am', "I'll": 'I will', "we'll": 'we will', "you'll": 'you will', "he'll": 'he will', "she'll": 'she will', "they'll": 'they will' };
const shown = (q: { visual?: { type: string; text?: string } }) => q.visual!.text!;

/** #993: Year 1 contraction reading. Contraction shown, child picks the two words it stands for. */
describe('y1-contractions (#993)', () => {
  it('is the first Year 1 writing topic', () => {
    expect(topic.year).toBe('year1');
    expect(topic.subject).toBe('writing');
    const first = TOPICS.find(t => t.year === 'year1' && t.subject === 'writing')!;
    expect(first.id).toBe('y1-contractions');
  });

  it.each(DS)('d%i: exactly one option is the expansion of the shown contraction', (d) => {
    for (let seed = 1; seed <= 300; seed++) {
      const q = topic.gen(d, rng(seed));
      const word = Object.keys(ORACLE).find(k => (d === 3 ? shown(q).toLowerCase().startsWith(k.toLowerCase()) : shown(q).toLowerCase() === k.toLowerCase()))!;
      expect(word, shown(q)).toBeTruthy();
      expect(q.answer).toBe(ORACLE[word]);
      expect(q.options.filter(o => o === ORACLE[word])).toHaveLength(1);
      expect(new Set(q.options).size).toBe(q.options.length);
      expect(q.options).toHaveLength(d === 1 ? 3 : 4);
    }
  });

  it('d1 uses only I\'m, I\'ll and we\'ll; d3 shows a sentence', () => {
    for (let seed = 1; seed <= 200; seed++) {
      expect(["i'm", "i'll", "we'll"]).toContain(shown(topic.gen(1, rng(seed))).toLowerCase());
      expect(topic.gen(3, rng(seed)).visual!.type).toBe('sentence');
    }
  });

  it('never uses an ambiguous contraction, speaks the contraction, or asks full form -> contraction', () => {
    for (const d of DS) for (let seed = 1; seed <= 300; seed++) {
      const q = topic.gen(d, rng(seed));
      expect(q.say ?? '').not.toContain("'");
      expect(q.options.every(o => !o.includes("'"))).toBe(true);
      expect(JSON.stringify(q)).not.toMatch(/he's|she's|it's|I'd|we'd/i);
    }
  });
});

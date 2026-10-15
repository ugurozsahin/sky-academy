import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID, GAP_WORDS } from '../../src/curriculum/util';
import { REAL_LOOKALIKES } from '../../src/curriculum/spelling-rules';
import { OUS_BANK } from '../../src/curriculum/year4-ous';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y4-ous')!;
// `AVOID` is a gap-spelling denylist and lists no crude whole words (G13): a short local set too.
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];
const RULES: Record<Difficulty, string[]> = { 1: ['root', 'noroot'], 2: ['root', 'noroot', 'y-i', 'our-or'], 3: ['root', 'noroot', 'y-i', 'our-or', 'keep-e', 'i-e'] };

describe('y4-ous (#1160)', () => {
  it('is registered once in Year 4 spelling', () => {
    expect(TOPICS.filter(t => t.id === 'y4-ous')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year4', subject: 'writing', strand: 'spelling' });
  });

  it('every bank word ends in ous and its rule tag matches the word itself', () => {
    for (const [word, rule, sentence, decoys] of OUS_BANK) {
      expect(word.endsWith('ous'), word).toBe(true);
      for (const w of [word, ...decoys]) expect(w.length, `${w} fits a wide bubble (R-LBL)`).toBeLessThanOrEqual(9);
      if (rule === 'our-or') expect(word, word).toContain('orous');
      if (rule === 'keep-e') expect(word, word).toContain('geous');
      if (rule === 'i-e') expect(/(i|e)ous$/.test(word), word).toBe(true);
      if (rule === 'y-i') expect(word.endsWith('ious'), word).toBe(true);
      expect(sentence.split('___').length, `${word}: exactly one gap`).toBe(2);
      expect(sentence.toLowerCase().includes(word), `${word} leaks into its sentence`).toBe(false);
      expect(decoys.includes(word) || new Set(decoys).size !== 3, `${word}: three distinct decoys`).toBe(false);
      for (const bad of [...AVOID, ...EXCLUDE]) expect(`${word} ${sentence}`.toLowerCase().includes(bad), `${word}: ${bad}`).toBe(false);
    }
  });

  it('every decoy is a non-word, the first is the rule-typical mistake, and the inventory is pinned', () => {
    const all: string[] = [];
    for (const [word, rule, , decoys] of OUS_BANK) {
      all.push(word, ...decoys);
      for (const w of decoys) {
        expect(GAP_WORDS.has(w) || AVOID.has(w) || REAL_LOOKALIKES.has(w), `${w} is a real word`).toBe(false);
        for (const a of AVOID) expect(w.includes(a), `${w} contains ${a}`).toBe(false);
        for (const e of EXCLUDE) expect(w.includes(e), `${w} contains ${e}`).toBe(false);
      }
      const typical = decoys[0];
      if (rule === 'our-or') expect(typical, word).toBe(word.replace('orous', 'ourous'));
      if (rule === 'keep-e') expect(typical, word).toBe(word.replace('geous', 'gous'));
      if (rule === 'y-i') expect(typical, word).toBe('varyous');
      if (rule === 'root' || rule === 'noroot') expect(typical, word).toBe(word.replace(/ous$/, 'us'));
      if (rule === 'i-e') expect(typical.slice(0, 3), word).toBe(word.slice(0, 3));
    }
    expect(all.sort()).toEqual(PINNED);
    expect(new Set(all).size).toBe(all.length);
  });

  it('builds the ladder: four wide bubbles, a sentence and a say, rules widening with difficulty', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const seenRules = new Set<string>();
      for (let s = 1; s <= 600; s++) {
        const q = topic.gen(d, rng(s * 13 + d));
        expect(q.options.length).toBe(4);
        expect(new Set(q.options).size).toBe(4);
        expect(q.wide).toBe(true);
        expect(q.visual).toEqual({ type: 'sentence', text: expect.stringContaining('___') });
        const row = OUS_BANK.find(r => r[0] === q.answer)!;
        expect(row, 'card comes from the bank').toBeDefined();
        expect((q.visual as { text: string }).text).toBe(row[2]);
        expect([...q.options].sort()).toEqual([row[0], ...row[3]].sort());
        expect(q.say).toContain(row[0]);
        expect(RULES[d]).toContain(row[1]);
        seenRules.add(row[1]);
      }
      expect([...seenRules].sort()).toEqual([...RULES[d]].sort());
    }
  });
});

const PINNED = [
  'curious', 'curiuos', 'curius', 'curous', 'dangarous', 'dangeros',
  'dangerous', 'dangerus', 'enormos', 'enormous', 'enormouss', 'enormus',
  'faimous', 'fameous', 'famous', 'famus', 'genarous', 'generos',
  'generous', 'generus', 'gorgeous', 'gorgeus', 'gorgious', 'gorgous',
  'hideous', 'hideus', 'hidious', 'hidous', 'humoros', 'humorous',
  'humorus', 'humourous', 'jealeous', 'jealous', 'jealus', 'jelous',
  'joious', 'joyeous', 'joyous', 'joyus', 'nerveous', 'nervos',
  'nervous', 'nervus', 'obveous', 'obvios', 'obvious', 'obvius',
  'poisenous', 'poisonos', 'poisonous', 'poisonus', 'seerious', 'serios',
  'serious', 'serius', 'various', 'varius', 'varous', 'varyous',
  'vigoros', 'vigorous', 'vigorus', 'vigourous',
];

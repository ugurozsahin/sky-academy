import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { BANK, HUMAN_ACTIONS, METAPHOR_VERBS } from '../../src/curriculum/year6-figurative';
import { rLblProblem } from './helpers/r-lbl';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-figurative')!;
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];
const draws = (d: Difficulty, n = 300) => { const r = rng(1241 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const words = (s: string) => s.toLowerCase().match(/[a-z]+/g) ?? [];
const textOf = (c: { visual?: unknown }) => (c.visual as { text: string }).text;
const bySentence = (s: string) => BANK.find(i => i.text === s)!;
const LETTER = { simile: 'S', metaphor: 'M', personification: 'P' } as const;
// Written here and not imported, so the oracle never re-reads the module's own list.
const HUMAN = ['whispered', 'danced', 'sang', 'smiled', 'wept', 'crept', 'sighed', 'grumbled', 'winked', 'marched', 'yawned', 'waved', 'frowned', 'laughed', 'knocked', 'complained', 'shouted', 'cried', 'argued', 'hugged', 'giggled', 'tiptoed'];
const LINKING = [' is ', ' was ', ' are ', ' were '];
const hasHuman = (s: string) => words(s).some(w => HUMAN.includes(w));
const hasCompare = (s: string) => / like | as /.test(s);

describe('y6-figurative (#1241)', () => {
  it('is registered once in Year 6 reading, with a plain title', () => {
    expect(TOPICS.filter(t => t.id === 'y6-figurative')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year6', subject: 'writing', strand: 'reading', title: 'Figurative Language' });
  });

  it('the module list equals the literal lexicon', () => {
    expect([...HUMAN_ACTIONS]).toEqual(HUMAN);
  });

  it('the bank holds at least 12 of each device, at least 4 of them subtle, every sentence once and at most 60 characters', () => {
    for (const dev of ['simile', 'metaphor', 'personification'] as const) {
      expect(BANK.filter(i => i.device === dev).length, dev).toBeGreaterThanOrEqual(12);
      expect(BANK.filter(i => i.device === dev && i.hard).length, dev).toBeGreaterThanOrEqual(4);
    }
    expect(new Set(BANK.map(i => i.text)).size).toBe(BANK.length);
    for (const i of BANK) expect(i.text.length, i.text).toBeLessThanOrEqual(60);
  });

  it('like / as: in every simile, in no metaphor and in no personification', () => {
    for (const i of BANK) expect(hasCompare(i.text), i.text).toBe(i.device === 'simile');
    for (const i of BANK.filter(i => i.device === 'simile')) expect(/ like |\bas\b.*\bas\b/.test(i.text), i.text).toBe(true);
  });

  it('human action: in every personification and in no simile or metaphor', () => {
    for (const i of BANK) expect(hasHuman(i.text), i.text).toBe(i.device === 'personification');
  });

  it('every metaphor says one thing is another, or leans on a closed verb', () => {
    for (const i of BANK.filter(i => i.device === 'metaphor')) {
      const linked = LINKING.some(l => i.text.includes(l)), verb = words(i.text).some(w => METAPHOR_VERBS.includes(w));
      expect(linked || (i.hard && verb), i.text).toBe(true);
    }
  });

  it('d1 never draws personification, and its bubbles are S and M', () => {
    for (const c of draws(1)) {
      expect(bySentence(textOf(c)).device).not.toBe('personification');
      expect([...c.options].sort()).toEqual(['M', 'S']);
      expect(c.prompt).toBe('S simile or M metaphor?');
    }
  });

  it('d2 and d3 have S, M and P as bubbles and the key in the prompt; d3 is the subtle forms', () => {
    const seen: Record<number, Set<string>> = { 2: new Set(), 3: new Set() };
    for (const d of [2, 3] as Difficulty[]) for (const c of draws(d)) {
      expect([...c.options].sort()).toEqual(['M', 'P', 'S']);
      expect(c.prompt).toBe('S simile, M metaphor or P personification?');
      expect(c.prompt.length).toBeLessThanOrEqual(48);
      expect(Boolean(bySentence(textOf(c)).hard)).toBe(d === 3);
      seen[d].add(c.answer);
    }
    expect([...seen[2]].sort()).toEqual(['M', 'P', 'S']);
    expect([...seen[3]].sort()).toEqual(['M', 'P', 'S']);
  });

  it('the answer letter is the sentence\'s device, no device name is a bubble, and every card has a say and a sentence visual', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) {
      const item = bySentence(textOf(c));
      expect(c.answer).toBe(LETTER[item.device]);
      for (const o of c.options) expect(o).toMatch(/^[SMP]$/);
      expect(c.visual?.type).toBe('sentence');
      expect(c.say).toContain(item.text);
      expect(c.wide).toBeFalsy();
    }
  });

  it('every label passes R-LBL on d1–d3', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) expect(rLblProblem(c), `${d} ${c.answer}`).toBeNull();
  });

  it('crude words stay out of every sentence', () => {
    for (const i of BANK) for (const w of words(i.text)) expect(AVOID.has(w) || EXCLUDE.includes(w), w).toBe(false);
  });
});

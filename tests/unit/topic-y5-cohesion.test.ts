import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { TIME, PLACE, NUMBER, PASSAGES, BUBBLE_MULTI, passageText } from '../../src/curriculum/year5-cohesion';
import { rLblProblem } from './helpers/r-lbl';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-cohesion')!;
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];
const draws = (d: Difficulty, n = 300) => { const r = rng(1228 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
// Literal lexicons, written here and not imported, so the oracle never re-reads the module's own lists.
const LEX: Record<string, string[]> = {
  time: ['later', 'afterwards', 'meanwhile', 'soon', 'eventually', 'after that', 'the next day', 'that evening'],
  place: ['nearby', 'outside', 'upstairs', 'in the distance', 'next door', 'behind the shed', 'across the road'],
  number: ['firstly', 'secondly', 'thirdly'],
};
const kindOf = (w: string) => Object.keys(LEX).filter(k => LEX[k].includes(w.toLowerCase()));
const lower = (s: string) => s.toLowerCase();

describe('y5-cohesion (#1228)', () => {
  it('is registered once in Year 5 writing, as grammar, with a plain title', () => {
    expect(TOPICS.filter(t => t.id === 'y5-cohesion')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year5', subject: 'writing', strand: 'grammar', title: 'Cohesion: linking adverbials' });
  });

  it('the module lists equal the literal lexicons and are disjoint', () => {
    expect([...TIME]).toEqual(LEX.time);
    expect([...PLACE]).toEqual(LEX.place);
    expect([...NUMBER]).toEqual(LEX.number);
    const all = [...TIME, ...PLACE, ...NUMBER];
    expect(new Set(all).size).toBe(all.length);
  });

  it('no list holds an ambiguous word', () => {
    for (const w of [...TIME, ...PLACE, ...NUMBER]) expect(['finally', 'lastly', 'then', 'there']).not.toContain(w);
  });

  it('d1: the answer is the shown adverbial\'s list name, with the three kinds as bubbles', () => {
    const seen = new Set<string>();
    for (const c of draws(1)) {
      const adv = (c.visual as { text: string }).text;
      expect(c.prompt).toBe(`What kind of adverbial is '${adv}'?`);
      expect(kindOf(adv)).toHaveLength(1);
      expect(c.answer).toBe(kindOf(adv)[0]);
      expect([...c.options].sort()).toEqual(['number', 'place', 'time']);
      seen.add(c.answer);
    }
    expect([...seen].sort()).toEqual(['number', 'place', 'time']);
  });

  it('d2/d3: exactly one option is of the named kind, and it is the answer', () => {
    for (const d of [2, 3] as Difficulty[]) {
      const kinds = new Set<string>();
      for (const c of draws(d)) {
        const kind = /^Which adverbial of (\w+) /.exec(c.prompt)![1];
        kinds.add(kind);
        expect(c.options).toHaveLength(3);
        expect(c.options.filter(o => kindOf(o)[0] === kind), c.prompt).toEqual([c.answer]);
        expect(c.options.map(o => kindOf(o)[0]).sort()).toEqual(['number', 'place', 'time']);
        const text = (c.visual as { text: string }).text;
        expect(PASSAGES.map(passageText)).toContain(text);
        expect(c.say).toContain('blank');
      }
      expect([...kinds].sort()).toEqual(['number', 'place', 'time']);
    }
  });

  it('ladder: d2 is single-word, d3 is multi-word for time and place across a new paragraph', () => {
    for (const c of draws(2)) {
      for (const o of c.options) expect(o).not.toContain(' ');
      expect(c.prompt).toMatch(/fits\?$/);
    }
    let multi = 0;
    for (const c of draws(3)) {
      expect(c.prompt).toMatch(/starts the new paragraph\?$/);
      expect(c.say!.startsWith('A new paragraph starts. ')).toBe(true);
      for (const o of c.options) if (o.includes(' ')) { multi++; expect(BUBBLE_MULTI).toContain(lower(o)); } else expect(NUMBER.concat(TIME, PLACE)).toContain(lower(o));
      for (const o of c.options.filter(o => kindOf(o)[0] !== 'number')) expect(o).toContain(' ');
    }
    expect(multi).toBeGreaterThan(0);
  });

  it('every bubble is capitalised, every card has a say, d2 and d3 have a sentence visual', () => {
    for (const d of [2, 3] as Difficulty[]) for (const c of draws(d)) {
      for (const o of c.options) expect(o[0]).toBe(o[0].toUpperCase());
      expect(c.say).toBeTruthy();
      expect(c.visual?.type).toBe('sentence');
    }
    for (const c of draws(1)) expect(c.say).toBeTruthy();
  });

  it('every label passes R-LBL on d1–d3', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) expect(rLblProblem(c), `${d} ${c.answer}`).toBeNull();
  });

  it('crude words stay out of every list, passage and bubble', () => {
    const words = [...TIME, ...PLACE, ...NUMBER, ...PASSAGES.flatMap(p => [...p])].flatMap(s => lower(s).match(/[a-z]+/g)!);
    for (const w of words) expect(AVOID.has(w) || EXCLUDE.includes(w), w).toBe(false);
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) for (const o of c.options) expect(AVOID.has(lower(o)) || EXCLUDE.includes(lower(o)), o).toBe(false);
  });
});

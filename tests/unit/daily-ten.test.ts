import { describe, it, expect } from 'vitest';
import type { Difficulty, Question, Rng, Topic } from '../../src/curriculum/types';
import { topicsFor } from '../../src/curriculum';
import { DAILY_TEN_DIFFS, dailyTenDeck, dailyTenPool } from '../../src/game/daily-ten';
import { repeatKey } from '../../src/game/session';

function rng(seed: number): Rng {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
/** A topic whose card says which difficulty and which draw it came from, so the deck's order is readable from its questions. */
const fake = (id: string, extra: Partial<Topic> = {}): Topic => {
  let n = 0;
  return { id, title: id, icon: '🔢', subject: 'maths', year: 'year2', nc: 'test', gen: (d: Difficulty): Question => ({ prompt: `${id} d${d} #${n++}`, answer: '1', options: ['1', '2', '3', '4'] }), ...extra };
};
const diffOf = (q: Question) => Number(/ d(\d) /.exec(q.prompt)![1]);

describe('Daily Ten (#1296)', () => {
  it('deals ten cards, difficulty 1 ×4, 2 ×4, 3 ×2, from the pool\'s own topics', () => {
    const topics = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'].map(id => fake(id));
    const deck = dailyTenDeck(topics, rng(1));
    expect(deck).toHaveLength(10);
    expect(deck.map(i => diffOf(i.q))).toEqual([...DAILY_TEN_DIFFS]);
    expect([...DAILY_TEN_DIFFS]).toEqual([1, 1, 1, 1, 2, 2, 2, 2, 3, 3]);
    for (const i of deck) expect(topics.map(t => t.id)).toContain(i.topic.id);
  });

  it('twelve topics give ten different topics, and no two neighbours share one', () => {
    const topics = Array.from({ length: 12 }, (_, i) => fake(`t${i}`));
    for (let seed = 1; seed <= 20; seed++) {
      const ids = dailyTenDeck(topics, rng(seed)).map(i => i.topic.id);
      expect(new Set(ids).size).toBe(10);
    }
  });

  it('a small pool repeats topics but never back to back, and an island of three still gives ten cards', () => {
    const three = ['a', 'b', 'c'].map(id => fake(id));
    for (let seed = 1; seed <= 20; seed++) {
      const ids = dailyTenDeck(three, rng(seed)).map(i => i.topic.id);
      expect(ids).toHaveLength(10);
      for (let i = 1; i < ids.length; i++) expect(ids[i], `seed ${seed}`).not.toBe(ids[i - 1]);
    }
  });

  it('leaves out writing, tracing, keypad, drill and ordered-sequence topics', () => {
    const topics = [fake('ok'), fake('words', { subject: 'writing' }), fake('trace', { input: 'tracing' }), fake('pad', { input: 'keypad' }), fake('drill', { drill: true }), fake('seq', { sequenceFrom: 2 })];
    expect(dailyTenPool(topics).map(t => t.id)).toEqual(['ok']);
    expect(new Set(dailyTenDeck(topics, rng(3)).map(i => i.topic.id))).toEqual(new Set(['ok']));
  });

  it('an island with no usable topic gives an empty deck, and no question repeats while the topic can deal another', () => {
    expect(dailyTenDeck([fake('words', { subject: 'writing' })], rng(1))).toEqual([]);
    const deck = dailyTenDeck(['a', 'b', 'c'].map(id => fake(id)), rng(2));
    expect(new Set(deck.map(i => repeatKey(i.q))).size).toBe(10);
  });

  it('a topic whose generator throws is skipped for the next one, and the deck still has ten cards', () => {
    const bad = fake('bad', { gen: () => { throw new Error('boom'); } }), good = fake('good'), also = fake('also');
    const err = console.error; console.error = () => {};
    try { const deck = dailyTenDeck([bad, good, also], rng(4)); expect(deck).toHaveLength(10); expect(deck.every(i => i.topic.id !== 'bad')).toBe(true); } finally { console.error = err; }
  });

  it('every real island with maths topics deals ten answerable cards whose answers are among their options', () => {
    for (const year of ['reception', 'year1', 'year2', 'year3', 'year4', 'year5', 'year6'] as const) {
      const topics = topicsFor(year);
      if (year === 'reception' || year === 'year1' || year === 'year2' || year === 'year3' || year === 'year4' || year === 'year5' || year === 'year6') expect(dailyTenPool(topics).length, `${year} has maths topics`).toBeGreaterThan(0);
      for (let seed = 1; seed <= 15; seed++) {
        const deck = dailyTenDeck(topics, rng(seed));
        expect(deck, `${year} seed ${seed}`).toHaveLength(10);
        for (const { topic, q } of deck) {
          expect(topic.subject).toBe('maths'); expect(topic.input).not.toBe('tracing');
          expect(q.sequence ?? q.options).toBeTruthy();
          if (!q.sequence) expect(q.options, `${topic.id}`).toContain(q.answer);
        }
      }
    }
  });
});

import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { DAYS } from '../../src/curriculum/util';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y1-when')!;
const PARTS = ['morning', 'afternoon', 'evening'], WORDS = ['yesterday', 'today', 'tomorrow'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DRAWS = 300;

describe('y1-when (#979)', () => {
  it('is registered under Year 1 maths', () => {
    expect(topic.year).toBe('year1');
    expect(topic.subject).toBe('maths');
  });

  it('the answer is the list neighbour the prompt asks for, and nothing ever wraps', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(9790 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        const where = `d${d} draw ${i}: ${q.prompt}`;
        const m = /^What comes (after|before) (\w+)\?$/.exec(q.prompt);
        if (m) {
          const list = PARTS.includes(m[2]) ? PARTS : WORDS;
          const idx = list.indexOf(m[2]);
          const want = list[m[1] === 'after' ? idx + 1 : idx - 1];
          expect(want, `${where} would wrap`).toBeDefined();
          expect(q.answer, where).toBe(want);
        } else if (q.prompt === 'Which part of the day comes first?') {
          expect(q.answer, where).toBe('morning');
        } else {
          expect(q.prompt, where).toBe('Which part of the day is missing?');
          const v = q.visual as { type: 'strip'; text: string };
          expect(v.type).toBe('strip');
          const cells = v.text.split(' ');
          expect(cells.filter(c => c === '_')).toHaveLength(1);
          expect(q.answer, where).toBe(PARTS[cells.indexOf('_')]);
        }
      }
    }
  });

  it('d1 hides each of the three day parts on its strip cards, about a third each, and offers only day-part words', () => {
    const r = rng(9791), hidden: Record<string, number> = { morning: 0, afternoon: 0, evening: 0 };
    let strips = 0;
    for (let i = 0; i < DRAWS; i++) {
      const q = topic.gen(1, r);
      expect([...q.options].sort()).toEqual([...PARTS].sort());
      if ((q.visual as { type?: string } | undefined)?.type !== 'strip') continue;
      strips++;
      hidden[q.answer]++;
    }
    for (const part of PARTS) {
      expect(hidden[part], `strip hides ${part}`).toBeGreaterThan(strips * 0.2);
      expect(hidden[part], `strip hides ${part}`).toBeLessThan(strips * 0.47);
    }
  });

  it('decoys come from the answer\'s own list first, then the other list, and never repeat the answer', () => {
    for (const d of [2, 3] as Difficulty[]) {
      const r = rng(9780 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        if (q.visual) continue;
        const own = PARTS.includes(q.answer) ? PARTS : WORDS;
        const where = `d${d} draw ${i}: ${q.prompt}`;
        expect(q.options, where).toHaveLength(4);
        for (const member of own) expect(q.options, where).toContain(member);
      }
    }
  });

  it('d2 and d3 reach both lists, d3 shows no strip, and decoys never repeat the answer', () => {
    for (const d of [2, 3] as Difficulty[]) {
      const r = rng(9795 + d), lists = new Set<string>();
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        lists.add(PARTS.includes(q.answer) ? 'parts' : 'words');
        if (d === 3) expect(q.visual).toBeUndefined();
        expect(q.options.filter(o => o === q.answer)).toHaveLength(1);
      }
      expect(lists.size, `d${d}`).toBe(2);
    }
  });

  it('no prompt or option names a weekday or a month, and every card has a say line', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(9799 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        for (const text of [q.prompt, ...q.options]) {
          for (const name of [...DAYS, ...MONTHS]) expect(text).not.toContain(name);
        }
        expect(q.say, `d${d} draw ${i}`).toBeTruthy();
      }
    }
  });
});

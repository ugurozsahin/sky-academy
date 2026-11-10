// #2318 (y1-spellrules, y1-spellrules2, y1-plurals, y2-spell-kn): the why states the rule the card tests.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const all = (id: string) => ([1, 2, 3] as Difficulty[]).flatMap(d => Array.from({ length: 200 }, (_, s) => TOPICS.find(x => x.id === id)!.gen(d, rngOf((s + 1) * 104729 + d))));

describe('spelling-rule topics say why (#2318)', () => {
  it('y1-plurals: the why names the plural and the rule for its ending', () => {
    for (const q of all('y1-plurals')) {
      const w = q.prompt.match(/two (\w+)__/)![1];
      expect(q.why).toBe(`${w}${q.answer}: ${q.answer === 's' ? 'just add s.' : 'add es after x, s, sh, ch.'}`);
    }
  });
  it('y2-spell-kn: the why names the silent letter the answer starts with', () => {
    for (const q of all('y2-spell-kn')) expect(q.why).toBe(`Silent ${q.answer[0]}: it starts ${q.answer.slice(0, 2)}.`);
  });
  it('y1-spellrules: a double-letter why names the ending the answer has', () => {
    for (const q of all('y1-spellrules').filter(q => /^After a short vowel, it ends/.test(q.why ?? ''))) expect(q.why).toBe(`After a short vowel, it ends -${q.answer.slice(-2)}.`);
  });
  it('y1-spellrules2: every card has a rule why that is not the answer repeated', () => {
    for (const id of ['y1-spellrules', 'y1-spellrules2']) for (const q of all(id)) { expect(q.why).toBeTruthy(); expect(q.why).not.toBe(q.answer); }
  });
});

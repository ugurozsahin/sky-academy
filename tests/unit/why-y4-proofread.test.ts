// #2318 (y4-proofread): the why says what is wrong with the shown spelling and gives the right one.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { D1_BANK, D2_BANK, D3_BANK, proofreadWhy, singleSlip } from '../../src/curriculum/year4-proofread';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, n) => TOPICS.find(x => x.id === 'y4-proofread')!.gen(d, rngOf((n + 1) * 104729 + d)));

describe('y4-proofread says why (#2318)', () => {
  it('every draw has a short why naming the right spelling, not the bare answer', () => {
    for (const d of [1, 2, 3] as const) for (const q of draws(d)) {
      expect(q.why).toBeTruthy(); expect(q.why).not.toBe(q.answer);
      expect(q.why).toContain(`"${q.spelt}"`); expect(q.why!.length).toBeLessThanOrEqual(70);
    }
  });
  it('names a slip only when it is the whole truth', () => {
    expect(proofreadWhy('pretty', 'prety')).toContain('missing a letter');
    expect(proofreadWhy('height', 'hieght')).toContain('two letters swapped');
    expect(proofreadWhy('money', 'muney')).toContain('one wrong letter');
    expect(proofreadWhy('Perhaps', 'Perhapps')).toContain('extra letter');
    for (const [t, w] of [['busy', 'bizzy'], ['picture', 'picher'], ['natural', 'nachural'], ['adventure', 'advencher'], ['creature', 'creacher']])
      expect(proofreadWhy(t, w)).toBe(`"${w}" is not the right spelling. It is "${t}".`);
  });
  it('every bank row says only what is true, and the claim re-applies to give the right word', () => {
    for (const [, target, wrong] of [...D1_BANK, ...D2_BANK, ...D3_BANK]) {
      const why = proofreadWhy(target, wrong), slip = singleSlip(target, wrong);
      expect(why.length, why).toBeLessThanOrEqual(70);
      expect(why).toContain(`"${wrong}"`); expect(why).toContain(`"${target}"`);
      const t = target.toLowerCase(), w = wrong.toLowerCase();
      if (slip === 'missing') expect(w.length).toBe(t.length - 1);
      else if (slip === 'extra') expect(w.length).toBe(t.length + 1);
      else if (slip) expect(w.length).toBe(t.length);
      else expect(why).toContain('not the right spelling');
    }
  });
});

// #2318 (y6-subjectobject): every question names the role's test in the sentence's own words.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { SUBJ_OBJ, roleWhy } from '../../src/curriculum/year6-subjectobject';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, n) => TOPICS.find(x => x.id === 'y6-subjectobject')!.gen(d, rngOf((n + 1) * 104729 + d)));

describe('y6-subjectobject says why (#2318)', () => {
  it('words each role', () => {
    expect(roleWhy(SUBJ_OBJ[0], 'subject')).toBe('"dog" is the do-er of the verb "chased".');
    expect(roleWhy(SUBJ_OBJ[0], 'object')).toBe('"cat" is what the verb "chased" acts on.');
    expect(roleWhy(SUBJ_OBJ.find(r => r[4] === 'passive')!, 'subject')).toBe('"key" has the verb done to it; "by Ali" names the do-er.');
    expect(roleWhy(SUBJ_OBJ.find(r => r[0].includes('twins'))!, 'subject')).toBe('"cake" has the verb done to it; "by the twins" names the do-er.');
  });
  it('every draw has a why naming its own answer', () => {
    for (const d of [1, 2, 3] as const) for (const q of draws(d)) { expect(q.why).toContain(`"${q.answer}"`); }
  });
});

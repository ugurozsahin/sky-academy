import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { FRAMES, PERFECT_VERBS, PERFECT_HELPERS, helperOf, formsOf, fill } from '../../src/curriculum/year5-perfect';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-perfect')!;
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];
const draws = (d: Difficulty, n = 400) => { const r = rng(1230 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
type Card = ReturnType<typeof topic.gen>;
const text = (c: Card) => (c.visual as { text: string }).text;
/** The frame a card came from, matched on its gapped sentence in either shape. */
const frameOf = (c: Card) => FRAMES.find(fr => {
  const forms = formsOf(fr);
  return text(c) === fill(fr, '___', forms[2]) || text(c) === fill(fr, helperOf(fr), '___');
})!;
const isHelperCard = (c: Card) => PERFECT_HELPERS.includes(c.answer as never);

/** The pinned frame list, in full, for review in the PR (#666): `[text, third person, anchor, verb, expected helper]`. The helper is a hand-read
 * literal, not recomputed, so a wrong flag or anchor on any row fails here. */
const PINNED: readonly (readonly [string, boolean, string, string, string])[] = [
  ['By the time we got there, the birds {aux} {pp} away.', false, 'past', 'fly', 'had'],
  ['The room was quiet because everyone {aux} {pp} home.', false, 'past', 'go', 'had'],
  ['Once she {aux} {pp} the letter, she posted it.', true, 'past', 'write', 'had'],
  ['The plate was empty because the dog {aux} {pp} the sausages.', true, 'past', 'eat', 'had'],
  ['Before Mia dropped the vase, she {aux} {pp} it from the shelf.', true, 'past', 'take', 'had'],
  ['He was sad because he {aux} {pp} his homework.', true, 'past', 'forget', 'had'],
  ['After the storm, we saw that the wind {aux} {pp} the fence.', true, 'past', 'break', 'had'],
  ['The team cheered when the coach {aux} {pp} Sam for the final.', true, 'past', 'choose', 'had'],
  ['Tom was tired because he {aux} {pp} all day.', true, 'past', 'speak', 'had'],
  ['Nobody was surprised because they {aux} {pp} the film before.', false, 'past', 'see', 'had'],
  ['I {aux} {pp} my key, so I cannot get in.', false, 'present', 'forget', 'have'],
  ['Sam {aux} {pp} all the biscuits, so the tin is empty.', true, 'present', 'eat', 'has'],
  ['The children {aux} {pp} their stories, so they can read them out.', false, 'present', 'write', 'have'],
  ['My brother {aux} {pp} my pen, so I cannot write.', true, 'present', 'take', 'has'],
  ['The mug {aux} {pp}, so we need a new one.', true, 'present', 'break', 'has'],
  ['Ella {aux} {pp} a book, so she is reading it now.', true, 'present', 'choose', 'has'],
  ['The birds {aux} {pp}, so the nest is empty.', false, 'present', 'fly', 'have'],
  ['You {aux} {pp} that film already, so you know the ending.', false, 'present', 'see', 'have'],
  ['Dad {aux} {pp} to the shop, so he is not at home.', true, 'present', 'go', 'has'],
  ['They {aux} {pp} too fast, so I cannot follow.', false, 'present', 'speak', 'have'],
];

describe('y5-perfect (#1230)', () => {
  it('is registered once in Year 5 writing, as grammar, with a plain title', () => {
    expect(TOPICS.filter(t => t.id === 'y5-perfect')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year5', subject: 'writing', strand: 'grammar', title: 'Perfect tense: had, has, have' });
  });

  it('pins the frame list as a literal', () => {
    expect(FRAMES.map(x => [x.text, x.third, x.anchor, x.verb, helperOf(x)])).toEqual(PINNED);
  });

  it('every frame has one of each slot, a verb in the table, and a helper recomputed from anchor and subject', () => {
    for (const fr of FRAMES) {
      expect(fr.text.split('{aux}'), fr.text).toHaveLength(2);
      expect(fr.text.split('{pp}'), fr.text).toHaveLength(2);
      expect(formsOf(fr), fr.text).toBeDefined();
      expect(helperOf(fr)).toBe(fr.anchor === 'past' ? 'had' : fr.third ? 'has' : 'have');
    }
    expect(FRAMES.some(x => x.anchor === 'past') && FRAMES.some(x => x.anchor === 'present')).toBe(true);
    expect(new Set(FRAMES.map(helperOf))).toEqual(new Set(PERFECT_HELPERS));
  });

  it('no verb row has two equal forms', () => {
    for (const v of PERFECT_VERBS) expect(new Set(v).size, v.join('/')).toBe(3);
  });

  it('oracle: a helper card answers helperOf(frame); a participle card answers the table\'s third column', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) {
      const fr = frameOf(c);
      expect(fr).toBeDefined();
      expect(c.answer).toBe(isHelperCard(c) ? helperOf(fr) : formsOf(fr)[2]);
    }
  });

  it('ladder: d1 helpers only, d2 participles only, d3 both kinds', () => {
    expect(draws(1).every(isHelperCard)).toBe(true);
    expect(draws(2).some(isHelperCard)).toBe(false);
    const d3 = draws(3);
    expect(d3.some(isHelperCard) && d3.some(c => !isHelperCard(c))).toBe(true);
  });

  it('bubbles: d1 had/has/have; d2 the participle, simple past and base of one row', () => {
    for (const c of draws(1)) expect([...c.options].sort()).toEqual([...PERFECT_HELPERS].sort());
    for (const c of draws(2)) expect([...c.options].sort()).toEqual([...formsOf(frameOf(c))].sort());
  });

  it('every bubble is one lower-case word', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) for (const o of c.options) expect(o).toMatch(/^[a-z]+$/);
  });

  it('every card has a sentence visual with one gap, and a say that speaks "blank"', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) {
      expect(c.visual?.type).toBe('sentence');
      expect(text(c).split('___')).toHaveLength(2);
      expect(c.say).toContain('blank');
      expect(c.say).not.toContain('___');
    }
  });

  it('crude words stay out of every sentence, form and bubble', () => {
    const words = [...FRAMES.map(x => x.text), ...PERFECT_VERBS.flat(), ...PERFECT_HELPERS];
    for (const w of words) for (const a of [...AVOID, ...EXCLUDE]) expect(w.toLowerCase(), w).not.toContain(a);
    for (const c of draws(3)) for (const o of c.options) for (const a of [...AVOID, ...EXCLUDE]) expect(o).not.toContain(a);
  });
});

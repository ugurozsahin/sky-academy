import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID, GAP_WORDS } from '../../src/curriculum/util';
import { ANT_BANK } from '../../src/curriculum/year5-ant';
import { REAL_LOOKALIKES } from '../../src/curriculum/spelling-rules';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-ant')!;
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];
const draws = (d: Difficulty, n = 300) => { const r = rng(1219 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const rowOf = (c: { answer: string; visual?: { type: string; text?: string } }) => ANT_BANK.find(r => r[1] === c.answer && c.visual?.type === 'sentence' && r[4] === c.visual.text)!;
const SHAPES = [['ant', 'ent'], ['ance', 'ence'], ['ancy', 'ency']];

/** Every stem + ending a card can show, answers and twins, sorted. Hand-read once: each twin is a non-word (#418 method). */
const INVENTORY = [
  'agancy', 'agency', 'decancy', 'decency', 'elegant', 'elegent', 'emergancy', 'emergency',
  'evidance', 'evidence', 'excellant', 'excellent', 'fluancy', 'fluency', 'frequant', 'frequent',
  'frequancy', 'frequency', 'hesitancy', 'hesitant', 'hesitency', 'hesitent', 'ignorant',
  'ignorent', 'importent', 'important', 'independance', 'independant', 'independence', 'independent', 'innocance',
  'innocant', 'innocence', 'innocent', 'observance', 'observant', 'observence', 'observent', 'obediance',
  'obediant', 'obedience', 'obedient', 'pleasant', 'pleasent', 'presidant', 'president', 'residance',
  'residant', 'residence', 'resident', 'substance', 'substence', 'distant', 'distent', 'tolerance',
  'tolerant', 'tolerence', 'tolerent', 'urgancy', 'urgency', 'vacancy', 'vacency', 'expectant', 'expectent',
].sort();

describe('y5-ant (#1219)', () => {
  it('is registered once in Year 5 writing, as spelling', () => {
    expect(TOPICS.filter(t => t.id === 'y5-ant')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year5', subject: 'writing', strand: 'spelling' });
  });

  it('oracle: stem + ending is the bank word, stem + twin is a non-word, one gap per sentence', () => {
    for (const [stem, ending, twin, , sentence] of ANT_BANK) {
      expect(SHAPES.some(([a, e]) => (ending === a && twin === e) || (ending === e && twin === a)), stem).toBe(true);
      const w = stem + twin;
      expect(GAP_WORDS.has(w) || AVOID.has(w), w).toBe(false);
      expect(sentence.split('___'), sentence).toHaveLength(2);
    }
    for (const w of ['confidant', 'decant', 'hesitance', 'dependant', 'pendant']) expect(REAL_LOOKALIKES.has(w), w).toBe(true);
    const bank = new Set(ANT_BANK.flatMap(([s, e, t]) => [s + e, s + t]));
    for (const w of REAL_LOOKALIKES) expect(bank.has(w), w).toBe(false);
  });

  it('keeps out the exclusions: confident, decent (real a-twins), assistant and assistance (crude decoys)', () => {
    const words = ANT_BANK.map(([s, e]) => s + e);
    for (const w of ['confident', 'confidence', 'decent', 'assistant', 'assistance']) expect(words).not.toContain(w);
    expect(ANT_BANK.some(([s, e]) => (s === 'confid' || s === 'dec') && (e === 'ant' || e === 'ent'))).toBe(false);
  });

  it('covers the p.18 example words bar the exclusions', () => {
    const words = new Set(ANT_BANK.map(([s, e]) => s + e));
    for (const w of ['observant', 'observance', 'expectant', 'hesitant', 'hesitancy', 'tolerant', 'tolerance', 'substance', 'innocent', 'innocence',
      'frequent', 'frequency', 'obedient', 'obedience', 'independent', 'independence', 'decency']) expect(words.has(w), w).toBe(true);
  });

  it('every card has two bubbles of one shape, a sentence visual and a say', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) {
      expect(c.options).toHaveLength(2);
      expect(SHAPES.some(s => s.every(o => c.options.includes(o)))).toBe(true);
      for (const o of c.options) expect(o.length).toBeLessThanOrEqual(4);
      const row = rowOf(c as never);
      expect(row, c.answer).toBeDefined();
      expect(c.visual?.type).toBe('sentence');
      expect(c.say).toContain(`Which ending spells ${row[0] + row[1]}?`);
    }
  });

  it('ladder: d1 -ant/-ent with a clue, d2 -ance/-ence, d3 adds -ancy/-ency with no clue', () => {
    for (const c of draws(1)) {
      expect(c.prompt).toBe(`Clue: ${rowOf(c as never)[3]}. Which ending?`);
      expect(['ant', 'ent']).toContain(c.answer);
    }
    for (const c of draws(2)) expect(['ance', 'ence']).toContain(c.answer);
    const d3 = draws(3, 800);
    for (const c of d3) expect(c.prompt).toBe('Which ending is right?');
    expect(new Set(d3.map(c => c.answer))).toEqual(new Set(['ant', 'ent', 'ance', 'ence', 'ancy', 'ency']));
  });

  it('crude words stay out of every word, sentence and bubble', () => {
    for (const [s, e, t, , sen] of ANT_BANK) for (const x of [s + e, s + t, sen])
      for (const a of [...AVOID, ...EXCLUDE]) expect(x.toLowerCase(), x).not.toContain(a);
  });

  it('pins the whole option inventory as a literal sorted list', () => {
    const inv = [...new Set(ANT_BANK.flatMap(([s, e, t]) => [s + e, s + t]))].sort();
    expect(inv).toEqual(INVENTORY);
  });
});

import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID, GAP_WORDS } from '../../src/curriculum/util';
import { PREFIXES, VERBPREFIX_BANK, VERDICTS, nonwords, vpSentence, vpVerb } from '../../src/curriculum/year5-verbprefix';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-verbprefix')!;
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];
const draws = (d: Difficulty, n = 400) => { const r = rng(1223 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
/** The bank row a card was drawn from: d1 by its prompt, d2 and d3 by their sentence. */
const rowOf = (c: { prompt: string; visual?: { text?: string } }) =>
  VERBPREFIX_BANK.find(r => c.visual ? c.visual.text === r[3] : c.prompt === `${r[2]} = ___${r[0]}`)!;
const WORDS = (s: string) => s.toLowerCase().match(/[a-z]+/g) ?? [];

/** The whole table, pinned: any change to a verdict is a reviewed diff. Order of letters: dis, de, mis, over, re. */
const PINNED = [
  'build:NNRRA', 'cook:NNRAR', 'cycle:NRNNA', 'eat:NNNAN', 'fill:NNRRA', 'flate:NANNR', 'flow:NRNAR', 'frost:NANNN',
  'fuse:NANRR', 'hydrate:NANRR', 'infect:ANNRR', 'judge:NNARR', 'like:ANRNN', 'pronounce:NNARR', 'qualify:ANNRR',
  'rail:NANNR', 'react:NNNAN', 'sleep:NNNAN', 'understand:NNANN', 'wind:NNNRA',
];
/** Appendix 1 Years 3–4 prefix examples, which belong to y3-prefix (#1103). */
const Y3_EXAMPLES = ['disappoint', 'disagree', 'disobey', 'misbehave', 'mislead', 'misspell', 'redo', 'refresh', 'return', 'reappear', 'redecorate'];
/** Every prefix + root spelling a card can show as a bubble's completion, sorted. Each N was checked against a dictionary. */
const INVENTORY = [
  'debuild', 'decook', 'deeat', 'defill', 'deinfect',
  'dejudge', 'delike', 'depronounce', 'dequalify', 'dereact', 'desleep', 'deunderstand',
  'dewind', 'disbuild', 'discook', 'discycle', 'diseat', 'disfill', 'disflate',
  'disflow', 'disfrost', 'disfuse', 'dishydrate', 'disjudge', 'dispronounce', 'disrail',
  'disreact', 'dissleep', 'disunderstand', 'diswind', 'miscycle', 'miseat',
  'misflate', 'misflow', 'misfrost', 'misfuse', 'mishydrate', 'misinfect', 'misqualify',
  'misrail', 'misreact', 'missleep', 'miswind', 'overcycle', 'overflate', 'overfrost',
  'overlike', 'overrail', 'overunderstand', 'reeat', 'refrost', 'relike', 'rereact',
  'resleep', 'reunderstand',
];

describe('y5-verbprefix (#1223)', () => {
  it('is registered once in Year 5 writing, as grammar, with a plain title', () => {
    expect(TOPICS.filter(t => t.id === 'y5-verbprefix')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year5', subject: 'writing', strand: 'grammar' });
    expect(topic.title).not.toMatch(/[()#]/);
  });

  it('oracle: every root has all five verdicts and exactly one answer, which is the bank verb', () => {
    expect(Object.entries(VERDICTS).map(([r, v]) => `${r}:${v}`).sort()).toEqual(PINNED);
    for (const [root, v] of Object.entries(VERDICTS)) {
      expect(v, root).toMatch(/^[ARN]{5}$/);
      expect([...v].filter(x => x === 'A'), root).toHaveLength(1);
      expect(nonwords(root).length, root).toBeGreaterThanOrEqual(2);
    }
    expect(new Set(VERBPREFIX_BANK.map(r => r[0]))).toEqual(new Set(Object.keys(VERDICTS)));
    for (const r of VERBPREFIX_BANK) expect(VERDICTS[r[0]][PREFIXES.indexOf(r[1])], vpVerb(r)).toBe('A');
  });

  it('every decoy is a non-word of its root and no rival is ever a bubble', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) {
      const row = rowOf(c as never);
      expect(row).toBeDefined();
      expect(c.answer).toBe(row[1]);
      for (const o of c.options.filter(o => o !== c.answer)) {
        expect(PREFIXES as readonly string[], o).toContain(o);
        expect(nonwords(row[0]), `${o}${row[0]}`).toContain(o);
      }
    }
  });

  it('no bank verb is an Appendix 1 Year 3–4 prefix example', () => {
    expect(Y3_EXAMPLES).toHaveLength(11);
    for (const r of VERBPREFIX_BANK) for (const w of [vpVerb(r), r[0], ...WORDS(vpSentence(r))]) expect(Y3_EXAMPLES, w).not.toContain(w);
  });

  it('each of the five prefixes is the answer of at least three entries', () => {
    for (const p of PREFIXES) expect(VERBPREFIX_BANK.filter(r => r[1] === p).length, p).toBeGreaterThanOrEqual(3);
  });

  it('ladder: d1 a meaning card with 3 bubbles, d2 a sentence card with 3, d3 a sentence card with 4', () => {
    for (const c of draws(1)) { expect(c.options).toHaveLength(3); expect(c.visual).toBeUndefined(); expect(c.prompt).toMatch(/ = ___/); }
    for (const c of draws(2)) { expect(c.options).toHaveLength(3); expect(c.visual?.type).toBe('sentence'); }
    for (const c of draws(3)) {
      expect(c.options).toHaveLength(4); expect(c.visual?.type).toBe('sentence');
      expect(nonwords(rowOf(c as never)[0]).length).toBeGreaterThanOrEqual(3);
    }
  });

  it('the sentence holds one gap, and filling it gives a sentence with the whole verb', () => {
    for (const r of VERBPREFIX_BANK) {
      expect(r[3].split('___'), r[3]).toHaveLength(2);
      expect(r[3]).toMatch(/___[a-z]/);
      expect(vpSentence(r)).toContain(r[1] + r[3].match(/___([a-z]+)/)![1]);
    }
    expect(new Set(VERBPREFIX_BANK.map(r => r[3])).size).toBe(VERBPREFIX_BANK.length);
  });

  it('every label is a prefix of 4 letters or fewer, and every card has a say with the whole verb', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) {
      for (const o of c.options) expect(o.length, o).toBeLessThanOrEqual(4);
      const row = rowOf(c as never);
      expect(c.options).toContain(c.answer);
      expect(c.say, 'speaks the gap, not the answer').toContain(d === 1 ? `Blank-${row[0]} means ${row[2]}.` : row[3].replace('___', 'blank-'));
      for (const p of PREFIXES) expect(c.say).not.toContain(p + row[0]);
      expect(c.say).not.toContain(vpSentence(row));
    }
  });

  it('no wrong spelling is a gap word, and crude words stay out of every spelling, sentence, meaning and bubble', () => {
    for (const r of VERBPREFIX_BANK) {
      const spellings = PREFIXES.map(p => p + r[0]);
      for (const w of spellings) { expect(GAP_WORDS.has(w) || AVOID.has(w), w).toBe(false); for (const a of AVOID) expect(w, w).not.toContain(a); }
      for (const w of [...WORDS(r[3]), ...WORDS(r[2]), ...PREFIXES]) { expect(AVOID.has(w), w).toBe(false); expect(EXCLUDE, w).not.toContain(w); }
    }
  });

  it('pins the whole non-word inventory as a literal sorted list', () => {
    const inv = [...new Set(VERBPREFIX_BANK.flatMap(r => nonwords(r[0]).map(p => p + r[0])))].sort();
    expect(inv).toEqual(INVENTORY);
  });
});

import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID, GAP_WORDS, Y2_CEW } from '../../src/curriculum/util';
import { REAL_LOOKALIKES } from '../../src/curriculum/spelling-rules';
import { ONE_BANK, MORE_BANK, SILENT_BANK } from '../../src/curriculum/year5-silent';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-silent')!;
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];
const draws = (d: Difficulty, n = 400) => { const r = rng(1229 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const crude = (s: string) => [...AVOID, ...EXCLUDE].some(a => s.toLowerCase().includes(a));
// Real words a one-letter gap could complete to, beyond the shared lists (lam_ + p, thum_ + p, com_ + p…).
const LOOKALIKES = new Set(['lamp', 'thump', 'comp', 'crump', 'limp', 'dept', 'coma']);
const OMITTED = ['knight', 'sword', 'yolk', 'hymn', 'aisle', 'foreign', 'muscle', 'rhyme', 'rhythm', 'yacht', 'climb', 'half', 'hour', 'could', 'should', 'would'];
const completed = ([w, at]: readonly [string, number, ...unknown[]], l: string) => w.slice(0, at) + l + w.slice(at + 1);

describe('y5-silent (#1229)', () => {
  it('is registered once in Year 5 spelling', () => {
    expect(TOPICS.filter(t => t.id === 'y5-silent')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year5', subject: 'writing', strand: 'spelling', title: 'Silent Letters' });
  });

  it('d1 words have exactly one silent letter, heard nowhere else in the word', () => {
    for (const r of ONE_BANK) { const [w, at] = r; expect(w.split(r[0][at]).length - 1, w).toBe(1); }
    for (const [w] of MORE_BANK) expect(ONE_BANK.some(r => r[0] === w), w).toBe(false);
    expect(ONE_BANK.map(r => r[0])).not.toContain('castle');
    expect(MORE_BANK.map(r => r[0])).toEqual(expect.arrayContaining(['listen', 'glisten', 'thistle', 'castle', 'whistle', 'condemn', 'psalm']));
  });

  it('no bank word is an exception word, a kn/gn/wr word, a list word or an excluded sound-alike', () => {
    for (const [w, , s] of SILENT_BANK) {
      expect(OMITTED, w).not.toContain(w);
      expect(Y2_CEW.map(x => x.toLowerCase()), w).not.toContain(w);
      expect(w, w).not.toMatch(/^(kn|gn|wr)/);
      expect(s.split(w).length - 1, s).toBe(1);
      expect(crude(w + s), w).toBe(false);
    }
  });

  it('d2: the answer restores the bank word; each decoy makes a non-word that is never in a list', () => {
    for (const r of SILENT_BANK) {
      const [w, at, , decoys] = r;
      expect(completed(r, w[at])).toBe(w);
      expect(decoys[0]).not.toBe(decoys[1]);
      for (const dc of decoys) {
        const c = completed(r, dc);
        expect(dc, c).not.toBe(w[at]);
        expect(GAP_WORDS.has(c) || LOOKALIKES.has(c) || REAL_LOOKALIKES.has(c) || SILENT_BANK.some(x => x[0] === c), `${c} is a real word`).toBe(false);
        expect(crude(c), c).toBe(false);
      }
    }
  });

  it('ladder: d1 find it, d2 put it back, d3 spell it with a peek', () => {
    for (const q of draws(1)) {
      const w = q.visual!.type === 'word' ? (q.visual as { text: string }).text : '';
      const row = ONE_BANK.find(r => r[0] === w)!;
      expect(q.prompt).toBe(`Which letter is silent in ${w}?`);
      expect(q.answer).toBe(row[0][row[1]]);
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(q.options.length).toBeLessThanOrEqual(4);
      for (const o of q.options) expect(w).toContain(o);
    }
    for (const q of draws(2)) {
      expect(q.visual?.type).toBe('sentence');
      expect(q.options).toHaveLength(3);
      expect((q.visual as { text: string }).text).toContain('_');
    }
    for (const q of draws(3)) {
      expect(SILENT_BANK.map(r => r[0])).toContain(q.answer);
      expect(q.sequence!.join('')).toBe(q.answer);
      expect(q.peek).toBe(true);
      expect(q.peekHint).toBe('Slice the letters in order');
      expect(q.options.length).toBeLessThanOrEqual(10);
    }
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d, 60)) { expect(q.say).toBeTruthy(); expect(q.options.some(crude)).toBe(false); }
  });

  it('the d2 option inventory (every completed spelling) is pinned', () => {
    const all = SILENT_BANK.flatMap(r => r[3].map(dc => completed(r, dc))).sort();
    expect(all).toEqual(PINNED);
    const seen = new Set<string>();
    for (const q of draws(2)) {
      const row = SILENT_BANK.find(r => (q.visual as { text: string }).text.includes(r[0].slice(0, r[1]) + '_' + r[0].slice(r[1] + 1)))!;
      for (const o of q.options) seen.add(completed(row, o));
    }
    for (const c of seen) expect(c === SILENT_BANK.find(r => completed(r, '') && c === r[0])?.[0] || all.includes(c) || SILENT_BANK.some(r => r[0] === c), c).toBe(true);
  });
});
const PINNED: string[] = [
  'ansner', 'anster', 'autumm', 'autumt', 'biscait', 'biscoit', 'bonest', 'carm', 'casdle', 'caskle',
  'catm', 'columm', 'columt', 'comg', 'comt', 'condemm', 'condemt', 'crumg', 'crumt', 'degt',
  'dekt', 'donest', 'dougt', 'doupt', 'fasden', 'fasken', 'gaitar', 'giard', 'glisden', 'glisken',
  'goard', 'goitar', 'icland', 'itland', 'lamg', 'lamt', 'limg', 'limt', 'lisden', 'lisken',
  'msalm', 'nump', 'numt', 'panm', 'patm', 'sarmon', 'satmon', 'shissors', 'skissors', 'solemp', 'solemt',
  'thisdle', 'thiskle', 'thumg', 'thumt', 'tomd', 'tomt', 'tsalm', 'whisdle', 'whiskle',
];

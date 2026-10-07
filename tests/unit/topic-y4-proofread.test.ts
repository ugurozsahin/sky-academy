import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID, GAP_WORDS, Y2_CEW } from '../../src/curriculum/util';
import { REAL_LOOKALIKES } from '../../src/curriculum/spelling-rules';
import { D1_BANK, D2_BANK, D3_BANK } from '../../src/curriculum/year4-proofread';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y4-proofread')!;
const draws = (d: Difficulty, n = 400) => { const r = rng(1170 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const bare = (w: string) => w.replace(/[.,?!;:]/g, '');
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];
const bad = (s: string) => [...AVOID, ...EXCLUDE].some(a => s.toLowerCase().includes(a));

// The test's own copy of the Year 3–4 statutory list (English Appendix 1, p.16), 100 entries, each form listed.
const Y34 = ('accident accidentally actual actually address answer appear arrive believe bicycle breath breathe build busy business ' +
  'calendar caught centre century certain circle complete consider continue decide describe different difficult disappear early earth ' +
  'eight eighth enough exercise experience experiment extreme famous favourite february forward forwards fruit grammar group guard guide ' +
  'heard heart height history imagine increase important interest island knowledge learn length library material medicine mention minute ' +
  'natural naughty notice occasion occasionally often opposite ordinary particular peculiar perhaps popular position possess possession ' +
  'possible potatoes pressure probably promise purpose quarter question recent regular reign remember sentence separate special straight ' +
  'strange strength suppose surprise therefore though although thought through various weight woman women').split(' ');
const RULE_WORDS = ['treasure', 'adventure', 'creature', 'question', 'measure', 'picture', 'station', 'position', 'enormous', 'pleasure', 'serious', 'curious'];
// Real words a misspelling must not equal.
const REAL = new Set(['clime', 'olde', 'cud', 'grate', 'pitcher', 'breath', 'bother', 'fiend', 'hole']);

const bank = (d: Difficulty) => (d === 1 ? D1_BANK : d === 2 ? D2_BANK : D3_BANK);
const correctOf = (sentence: string, wrong: string, target: string) => sentence.replace(wrong, target);

describe('y4-proofread (#1170)', () => {
  it('is registered once in Year 4 spelling', () => {
    expect(TOPICS.filter(t => t.id === 'y4-proofread')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year4', subject: 'writing', strand: 'spelling' });
  });

  it('oracle: one option differs from the correct sentence, it is the answer, and the card equals the correct sentence with it swapped', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const rows = new Map(bank(d).map(r => [r[0], r]));
      for (const c of draws(d)) {
        const text = (c.visual as { type: 'sentence'; text: string }).text;
        const row = [...rows.values()].find(r => r[0].replace(r[1], r[2]) === text)!;
        expect(row, text).toBeDefined();
        const [sentence, target, wrong] = row;
        expect(c.answer).toBe(wrong);
        expect(c.options).toContain(wrong);
        const correctWords = new Set(sentence.split(' ').map(bare));
        const off = c.options.filter(o => !correctWords.has(o));
        expect(off).toEqual([wrong]);
        expect(correctOf(text, wrong, target)).toBe(sentence);
        expect(new Set(c.options.map(o => o.toLowerCase())).size).toBe(c.options.length);
        expect(c.options).not.toContain(target);
        expect(c.wide).toBe(true);
      }
    }
  });

  it('say speaks the correct sentence and never the misspelling', () => {
    for (const d of [1, 2, 3] as Difficulty[])
      for (const c of draws(d, 100)) {
        const text = (c.visual as { type: 'sentence'; text: string }).text;
        expect(c.say!.split(/[\s.,?]+/)).not.toContain(c.answer);
        expect(c.say).toContain('Which word is spelt wrong?');
        expect(c.say!.startsWith(text.replace(c.answer, bank(d).find(r => r[2] === c.answer)![1]))).toBe(true);
      }
  });

  it('every misspelling is a non-word, crude-free, and pinned as a sorted literal list', () => {
    const all = [...D1_BANK, ...D2_BANK, ...D3_BANK];
    for (const [sentence, target, wrong] of all) {
      expect(sentence.length, sentence).toBeLessThanOrEqual(60);
      expect(sentence.split(' ').map(bare), sentence).toContain(target);
      expect(wrong.toLowerCase(), wrong).not.toBe(target.toLowerCase());
      expect(wrong.length, wrong).toBeLessThanOrEqual(9);
      const w = wrong.toLowerCase();
      expect(GAP_WORDS.has(w), wrong).toBe(false);
      expect(REAL_LOOKALIKES.has(w), wrong).toBe(false);
      expect(REAL.has(w), wrong).toBe(false);
      expect(Y34.includes(w), wrong).toBe(false);
      expect(bad(w), wrong).toBe(false);
    }
    expect(all.map(r => r[2]).sort()).toEqual([
      'adress', 'advencher', 'apear', 'arive', 'barth', 'becuase', 'beleive', 'beutiful', 'bizzy', 'bothe', 'cought',
      'childrin', 'clim', 'concider', 'coud', 'creacher', 'deside', 'diffrent', 'dificult', 'dissapear', 'enormus', 'eigth', 'evry', 'exersise',
      'famus', 'Febuary', 'favourit', 'fynd', 'gaurd', 'grait', 'grarss', 'hieght', 'hoald', 'importent', 'kinde', 'libary', 'mesure', 'muney',
      'nachural', 'ould', 'parrents', 'parth', 'peeple', 'Perhapps', 'picher', 'plesure', 'populer', 'possition', 'prety', 'promiss', 'quesion',
      'reguler', 'rember', 'shugar', 'shure', 'sircle', 'staition', 'strainge', 'suprise', 'tresure', 'watter', 'whoel', 'brethe',
    ].sort());
  });

  it('targets come from the right list at each difficulty, and each d2–d3 row has a second list word as a decoy', () => {
    for (const [, target] of D1_BANK) expect(Y2_CEW, target).toContain(target.toLowerCase());
    for (const d of [2, 3] as Difficulty[])
      for (const [sentence, target, , other] of bank(d)) {
        expect(d === 2 ? Y34 : [...Y34, ...RULE_WORDS], target).toContain(target.toLowerCase());
        expect(Y34, other).toContain(other.toLowerCase());
        expect(sentence.split(' ').map(bare)).toContain(other);
        expect(other).not.toBe(target);
      }
    for (const d of [2, 3] as Difficulty[])
      for (const c of draws(d)) {
        const row = bank(d).find(r => r[2] === c.answer)!;
        expect(c.options, c.answer).toContain(row[3]);
      }
  });

  it('ladder: bubble counts, sentence length, and every word is a plain word', () => {
    for (const [d, n] of [[1, 3], [2, 4], [3, 5]] as [Difficulty, number][])
      for (const c of draws(d)) {
        expect(c.options).toHaveLength(n);
        for (const o of c.options) expect(o.length).toBeLessThanOrEqual(9);
        const text = (c.visual as { text: string }).text;
        if (d === 1) expect(text.split(' ').length).toBeLessThanOrEqual(6);
        if (d === 3) {
          expect(text.split(' ').length).toBeLessThanOrEqual(9);
          for (const o of c.options.filter(o => o !== c.answer)) expect(o.length, o).toBeGreaterThanOrEqual(5);
        }
      }
  });

  it('every row can fill its bubbles from distinct sentence words', () => {
    for (const [d, n] of [[1, 3], [2, 4], [3, 5]] as [Difficulty, number][])
      for (const [sentence, target] of bank(d)) {
        const pool = new Set(sentence.split(' ').map(bare).filter(w => w !== target && w.length >= (d === 3 ? 5 : 3) && w.length <= 9).map(w => w.toLowerCase()));
        expect(pool.size, sentence).toBeGreaterThanOrEqual(n - 1);
      }
  });

  it('d2–d3: the answer is the longest option on at most half the cards', () => {
    for (const d of [2, 3] as Difficulty[]) {
      const cards = draws(d);
      const longest = cards.filter(c => c.options.every(o => o === c.answer || o.length < c.answer.length)).length;
      expect(longest / cards.length, `d${d}`).toBeLessThanOrEqual(0.5);
    }
  });

  it('every bank sentence and word passes the local crude check', () => {
    for (const [sentence] of [...D1_BANK, ...D2_BANK, ...D3_BANK])
      for (const w of sentence.split(' ').map(bare)) expect(new Set<string>([...AVOID, ...EXCLUDE]).has(w.toLowerCase()), w).toBe(false);
  });
});

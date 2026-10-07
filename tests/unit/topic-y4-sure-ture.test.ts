import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID, GAP_WORDS } from '../../src/curriculum/util';
import { HOMOPHONE_SETS } from '../../src/curriculum/year2';
import { REAL_LOOKALIKES } from '../../src/curriculum/spelling-rules';
import { SURE_BANK, TURE_BANK, SION_BANK, CHER_BANK } from '../../src/curriculum/year4-sure-ture';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y4-sure-ture')!;
const BANKS = [SURE_BANK, TURE_BANK, SION_BANK, CHER_BANK];
const BANK = BANKS.flat();
const ENDINGS = ['sure', 'ture', 'sion', 'cher'];
// `AVOID` is a gap-spelling denylist and lists no crude whole words (G13): a short local set too.
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];

describe('y4-sure-ture (#1159)', () => {
  it('is registered once in Year 4 spelling', () => {
    expect(TOPICS.filter(t => t.id === 'y4-sure-ture')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year4', subject: 'writing', strand: 'spelling' });
  });

  it('the stem plus the answer is the bank word, and every word obeys the Appendix 1 rule', () => {
    const homophones = new Set(HOMOPHONE_SETS.flat());
    for (const [stem, ending, sentence] of BANK) {
      const word = stem + ending;
      expect(sentence.split('___').length, `${word}: exactly one gap`).toBe(2);
      expect(sentence.endsWith(`${stem}___.`) || sentence.includes(`${stem}___ `), `${word}: gap follows the stem`).toBe(true);
      expect(sentence.toLowerCase().replace(`${stem}___`, '').includes(word), `${word} leaks into its sentence`).toBe(false);
      expect(homophones.has(word), `${word} has a common homophone`).toBe(false);
      for (const bad of [...AVOID, ...EXCLUDE]) expect(`${word} ${sentence}`.toLowerCase().includes(bad), `${word}: ${bad}`).toBe(false);
    }
    for (const [, ending] of SURE_BANK) expect(ending).toBe('sure');
    for (const [, ending] of SION_BANK) expect(ending).toBe('sion');
    for (const [, ending] of TURE_BANK) expect(ending).toBe('ture');
    for (const [stem, ending] of CHER_BANK) {
      expect(ending).toBe('cher');
      const root = (stem + ending).slice(0, -2);
      expect(/t?ch$/.test(root), `${stem + ending}: root ${root} ends in ch`).toBe(true);
    }
  });

  it('every assembled wrong spelling is a non-word, and the inventory is pinned', () => {
    const homophones = new Set(HOMOPHONE_SETS.flat());
    const all: string[] = [];
    for (const [stem, ending] of BANK) for (const e of ENDINGS) {
      const w = stem + e;
      all.push(w);
      if (e === ending) continue;
      expect(GAP_WORDS.has(w) || AVOID.has(w) || REAL_LOOKALIKES.has(w) || homophones.has(w), `${w} is a real word`).toBe(false);
      for (const a of AVOID) expect(w.includes(a), `${w} contains ${a}`).toBe(false);
    }
    expect(all.sort()).toEqual(PINNED);
    expect(new Set(all).size).toBe(all.length);
  });

  it('builds the ladder: 2, 3 then 4 endings, each card with a sentence and a say', () => {
    const allowed = (d: Difficulty) => ENDINGS.slice(0, d + 1);
    for (const d of [1, 2, 3] as Difficulty[]) {
      const seen = new Set<string>();
      for (let s = 1; s <= 400; s++) {
        const q = topic.gen(d, rng(s * 11 + d));
        seen.add(q.answer);
        expect(q.options.length).toBe(d + 1);
        expect([...q.options].sort()).toEqual([...allowed(d)].sort());
        expect(q.visual).toEqual({ type: 'sentence', text: expect.stringContaining('___') });
        const row = BANK.find(r => r[1] === q.answer && r[2] === (q.visual as { text: string }).text)!;
        expect(row, 'card comes from the bank').toBeDefined();
        expect(q.say).toContain(row[0] + row[1]);
      }
      expect([...seen].sort()).toEqual([...allowed(d)].sort());
    }
  });
});

const PINNED = [
  'advencher', 'advension', 'advensure', 'adventure', 'capcher', 'capsion', 'capsure', 'capture',
  'catcher', 'catsion', 'catsure', 'catture', 'collicher', 'collision', 'collisure', 'colliture',
  'confucher', 'confusion', 'confusure', 'confuture', 'creacher', 'creasion', 'creasure', 'creature',
  'decicher', 'decision', 'decisure', 'deciture', 'divicher', 'division', 'divisure', 'diviture',
  'enclocher', 'enclosion', 'enclosure', 'encloture', 'furnicher', 'furnision', 'furnisure', 'furniture',
  'invacher', 'invasion', 'invasure', 'invature', 'leicher', 'leision', 'leisure', 'leiture',
  'meacher', 'measion', 'measure', 'meature', 'mixcher', 'mixsion', 'mixsure', 'mixture',
  'piccher', 'picsion', 'picsure', 'picture', 'pleacher', 'pleasion', 'pleasure', 'pleature',
  'richer', 'rision', 'risure', 'riture', 'stretcher', 'stretsion', 'stretsure', 'stretture',
  'teacher', 'teasion', 'teasure', 'teature', 'televicher', 'television', 'televisure', 'televiture',
  'treacher', 'treasion', 'treasure', 'treature', 'watcher', 'watsion', 'watsure', 'watture',
];

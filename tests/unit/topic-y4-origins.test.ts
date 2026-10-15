import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID, GAP_WORDS } from '../../src/curriculum/util';
import { HOMOPHONE_SETS } from '../../src/curriculum/year2';
import { FAMILIES, PHONETIC, ORIGINS_REAL, dropDecoy, CH_K_BANK, CH_SH_BANK, SC_BANK, GUE_QUE_BANK, EI_BANK } from '../../src/curriculum/year4-origins';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y4-origins')!;
const HOMOPHONES = new Set(HOMOPHONE_SETS.flat());
const BANK = FAMILIES.flatMap((f, i) => f.bank.map(r => ({ r, f, i })));
// `AVOID` is a gap-spelling denylist and lists no crude whole words (G13): a short local set too.
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];
const isReal = (w: string) => GAP_WORDS.has(w) || AVOID.has(w) || ORIGINS_REAL.has(w) || HOMOPHONES.has(w);

describe('y4-origins (#1162)', () => {
  it('is registered once in Year 4 spelling', () => {
    expect(TOPICS.filter(t => t.id === 'y4-origins')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year4', subject: 'writing', strand: 'spelling' });
  });

  it('every sentence has one gap that the answer fills to spell the bank word; excluded words stay out', () => {
    for (const { r: [pre, answer, post, sentence] } of BANK) {
      const word = pre + answer + post;
      expect(sentence.split('___').length, `${word}: one gap`).toBe(2);
      expect(sentence.includes(`${pre}___${post}`), `${word}: gap sits inside the word`).toBe(true);
      expect(sentence.toLowerCase().includes(word), `${word} leaks into its sentence`).toBe(false);
      for (const bad of [...AVOID, ...EXCLUDE]) expect(`${word} ${sentence}`.toLowerCase().includes(bad), `${word}: ${bad}`).toBe(false);
      expect(HOMOPHONES.has(word), `${word} has a homophone`).toBe(false);
    }
    const words = BANK.map(({ r }) => r[0] + r[1] + r[2]);
    for (const w of ['vein', 'weigh', 'grey', 'cheque', 'plague', 'echo', 'reins']) expect(words).not.toContain(w);
    expect(new Set(words).size).toBe(words.length);
  });

  it('every decoy that is offered spells a non-word, and the inventory is pinned', () => {
    const all: string[] = [];
    for (const { r: [pre, answer, post], f } of BANK) for (const l of f.pool) {
      const w = pre + l + post;
      all.push(w);
      if (l === answer) continue;
      if (dropDecoy(w)) continue; // never offered: a real word or an AVOID entry inside
      expect(isReal(w), `${w} is a real word`).toBe(false);
    }
    expect(all.sort()).toEqual(PINNED);
  });

  it('builds the ladder: families by difficulty, the phonetic decoy on every card, no real-word decoy', () => {
    const fams: Record<number, Set<readonly unknown[]>> = {
      1: new Set([CH_K_BANK, CH_SH_BANK]), 2: new Set([CH_K_BANK, CH_SH_BANK, SC_BANK, GUE_QUE_BANK]),
      3: new Set([CH_K_BANK, CH_SH_BANK, SC_BANK, GUE_QUE_BANK, EI_BANK]),
    };
    for (const d of [1, 2, 3] as Difficulty[]) {
      const seen = new Set<unknown>();
      for (let s = 1; s <= 600; s++) {
        const q = topic.gen(d, rng(s * 7 + d));
        const text = (q.visual as { type: string; text: string }).text;
        expect(q.visual).toMatchObject({ type: 'sentence' });
        const hit = BANK.find(({ r }) => r[3] === text && r[1] === q.answer)!;
        expect(hit, 'card comes from the bank').toBeDefined();
        seen.add(hit.f.bank);
        expect(fams[d].has(hit.f.bank)).toBe(true);
        const [pre, , post] = hit.r;
        expect(q.options).toContain(PHONETIC[hit.i]);
        expect(q.options.length).toBeGreaterThanOrEqual(3);
        expect(q.options.length).toBeLessThanOrEqual(4);
        for (const o of q.options) if (o !== q.answer) expect(isReal(pre + o + post) || dropDecoy(pre + o + post), `${pre + o + post}`).toBe(false);
        expect(q.say).toContain(pre + q.answer + post);
      }
      expect(seen.size).toBe(fams[d].size);
    }
    const tongue = BANK.find(({ r }) => r[0] === 'ton')!;
    expect(tongue.f.pool.filter(l => !dropDecoy('ton' + l))).toEqual(['gue', 'que', 'ck']);
  });
});

const PINNED = [
  'antick', 'antig', 'antigue', 'antique', 'ayt', 'boutick', 'boutig', 'boutigue',
  'boutique', 'brochure', 'broshure', 'brosure', 'caracter', 'cemist', 'cene', 'character',
  'chef', 'chemist', 'chorus', 'cience', 'cissors', 'corus', 'crecent', 'crescent',
  'cresent', 'dicipline', 'discipline', 'disipline', 'eight', 'eit', 'eyt', 'facinate',
  'fascinate', 'fasinate', 'frayt', 'freight', 'freit', 'freyt', 'karacter', 'kemist',
  'korus', 'leack', 'leag', 'league', 'leaque', 'machine', 'mashine', 'masine',
  'moustache', 'moustase', 'moustashe', 'naybour', 'neibour', 'neighbour', 'neybour', 'obay',
  'obei', 'obeigh', 'obey', 'parachute', 'parashute', 'parasute', 'sceme', 'scene',
  'scheme', 'school', 'science', 'scissors', 'scool', 'sef', 'sene', 'shef',
  'sience', 'sissors', 'skeme', 'skool', 'stomac', 'stomach', 'stomak', 'thay',
  'thei', 'theigh', 'they', 'tonck', 'tong', 'tongue', 'tonque', 'wayt',
  'weight', 'weit', 'weyt',
];


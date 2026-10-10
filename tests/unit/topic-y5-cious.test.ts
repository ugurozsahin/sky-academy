import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID, GAP_WORDS } from '../../src/curriculum/util';
import { CIOUS_BANK, ciousQ } from '../../src/curriculum/year5-cious';
import { REAL_LOOKALIKES } from '../../src/curriculum/spelling-rules';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-cious')!;
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];
const draws = (d: Difficulty, n = 300) => { const r = rng(1218 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const WORDS = ['vicious', 'precious', 'conscious', 'delicious', 'malicious', 'suspicious', 'ambitious', 'cautious', 'fictitious', 'infectious', 'nutritious',
  'official', 'special', 'artificial', 'partial', 'confidential', 'essential', 'gracious', 'spacious', 'anxious', 'initial', 'financial', 'commercial', 'provincial'];

/** Every stem + ending a card can show, answers and decoys, sorted. Hand-read once: each decoy is a non-word (#418 method). */
const INVENTORY = [
  'ambicious', 'ambitious', 'ambixious', 'ancious', 'antious', 'anxious',
  'artificial', 'artifitial', 'artifitious', 'artifixious', 'caucious', 'cautious',
  'cauxious', 'commercial', 'commertial', 'commertious', 'commerxious', 'confidencial',
  'confidencious', 'confidential', 'confidentious', 'conscious', 'constious', 'consxious',
  'delicious', 'delitious', 'delixious', 'essencial', 'essencious', 'essential',
  'essentious', 'ficticious', 'fictitious', 'fictixious', 'financial', 'finantial',
  'finantious', 'finanxious', 'gracious', 'gratious', 'graxious', 'infeccious',
  'infectious', 'infecxious', 'inicial', 'inicious', 'initial', 'initious',
  'malicious', 'malitious', 'malixious', 'nutricious', 'nutritious', 'nutrixious',
  'official', 'offitial', 'offitious', 'offixious', 'parcial', 'parcious',
  'partial', 'partious', 'precious', 'pretious', 'prexious', 'provincial',
  'provintial', 'provintious', 'provinxious', 'spacious', 'spatious', 'spaxious',
  'special', 'spetial', 'spetious', 'spexious', 'suspicious', 'suspitious',
  'suspixious', 'vicious', 'vitious', 'vixious',
];

describe('y5-cious (#1218)', () => {
  it('is registered once in Year 5 writing, as spelling', () => {
    expect(TOPICS.filter(t => t.id === 'y5-cious')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year5', subject: 'writing', strand: 'spelling' });
  });

  it('the bank is every p.18 word plus gracious and spacious, each once, in one sentence with one gap', () => {
    expect(CIOUS_BANK.map(([s, e]) => s + e).sort()).toEqual([...WORDS].sort());
    for (const [, , , sentence] of CIOUS_BANK) expect(sentence.split('___')).toHaveLength(2);
  });

  it('oracle: answer is the entry ending; every decoy is allowed and makes a non-word', () => {
    for (const [stem, ending, decoys] of CIOUS_BANK) {
      expect(decoys).not.toContain(ending);
      for (const dc of decoys) {
        const w = stem + dc;
        expect(GAP_WORDS.has(w) || REAL_LOOKALIKES.has(w) || AVOID.has(w), w).toBe(false);
      }
    }
    expect(REAL_LOOKALIKES.has('officious') && REAL_LOOKALIKES.has('specious')).toBe(true);
    for (const stem of ['offi', 'spe']) expect(CIOUS_BANK.find(r => r[0] === stem)![2]).not.toContain('cious');
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) {
      const row = CIOUS_BANK.find(r => r[1] === c.answer && c.visual?.type === 'sentence' && r[3] === c.visual.text)!;
      expect(row, c.answer).toBeDefined();
      for (const o of c.options) expect(o === c.answer || row[2].includes(o), o).toBe(true);
    }
  });

  it('ladder: d1 -cious/-tious with a clue, d2 -cial/-tial, d3 mixed with 3 bubbles', () => {
    for (const c of draws(1)) {
      const row = CIOUS_BANK.find(r => r[1] === c.answer && c.visual?.type === 'sentence' && r[3] === c.visual.text)!;
      expect(c.prompt).toBe(`Clue: ${row[4]}. Which ending?`);
      expect(['cious', 'tious']).toContain(c.answer);
      expect(new Set(c.options)).toEqual(new Set(['cious', 'tious']));
    }
    for (const c of draws(2)) {
      expect(['cial', 'tial']).toContain(c.answer);
      expect(new Set(c.options)).toEqual(new Set(['cial', 'tial']));
      expect(c.prompt).toBe('Which ending is right?');
    }
    const d3 = draws(3, 600);
    for (const c of d3) { expect(c.options).toHaveLength(3); expect(c.prompt).toBe('Which ending is right?'); }
    expect(new Set(d3.map(c => c.answer))).toEqual(new Set(['cious', 'tious', 'cial', 'tial', 'xious']));
  });

  it('-cial follows a vowel letter and -tial a consonant letter, apart from the exceptions', () => {
    const exceptions = new Set(['initial', 'financial', 'commercial', 'provincial']);
    for (const [s, e] of CIOUS_BANK) if ((e === 'cial' || e === 'tial') && !exceptions.has(s + e))
      expect(e === 'cial', s + e).toBe(/[aeiou]$/.test(s));
  });

  it('never a whole-word bubble, speaks the whole word, and keeps crude words out', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) {
      for (const o of c.options) expect(o.length).toBeLessThanOrEqual(5);
      expect(c.visual?.type).toBe('sentence');
      expect(c.say).toContain('Which ending spells');
      const row = CIOUS_BANK.find(r => c.visual?.type === 'sentence' && r[3] === c.visual.text)!;
      expect(c.say).toContain(`Which ending spells ${row[0] + row[1]}?`);
    }
    for (const [s, e, ds, sen] of CIOUS_BANK) for (const x of [s + e, sen, ...ds.map(d => s + d)])
      for (const a of [...AVOID, ...EXCLUDE]) expect(x.toLowerCase(), x).not.toContain(a);
  });

  it('pins the whole option inventory as a literal sorted list', () => {
    const inv = [...new Set(CIOUS_BANK.flatMap(([s, e, ds]) => [e, ...ds].map(o => s + o)))].sort();
    expect(inv).toEqual(INVENTORY);
  });

  it('refuses a card with too few decoys rather than returning a one-option card', () => {
    expect(() => ciousQ(rng(1), ['vi', 'cious', [], 'x vi___.'], 2, false)).toThrow(/too few decoys/);
  });
});

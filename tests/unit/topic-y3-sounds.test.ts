import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID, GAP_WORDS } from '../../src/curriculum/util';
import { HOMOPHONE_SETS } from '../../src/curriculum/year2';
import { REAL_LOOKALIKES } from '../../src/curriculum/spelling-rules';
import { Y_BANK, OU_BANK } from '../../src/curriculum/year3-sounds';
import { rLblProblem } from './helpers/r-lbl';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y3-sounds')!;
const BANK = [...Y_BANK, ...OU_BANK];
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];
const words = (bank: readonly (readonly unknown[])[]) => bank.map(r => r[0] as string);

describe('y3-sounds (#1111)', () => {
  it('is registered once in Year 3 writing, spelling strand', () => {
    expect(TOPICS.filter(t => t.id === 'y3-sounds')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year3', subject: 'writing', strand: 'spelling' });
  });

  it('bank: at least 10 words per pattern, every Appendix 1 example present, the pattern sits where the sound is', () => {
    expect(Y_BANK.length).toBeGreaterThanOrEqual(10);
    expect(OU_BANK.length).toBeGreaterThanOrEqual(10);
    expect(words(Y_BANK)).toEqual(expect.arrayContaining(['myth', 'gym', 'Egypt', 'pyramid', 'mystery']));
    expect(words(OU_BANK)).toEqual(expect.arrayContaining(['young', 'touch', 'double', 'trouble', 'country']));
    for (const [w] of Y_BANK) { const i = w.toLowerCase().indexOf('y'); expect(i, `${w}: has a y`).toBeGreaterThanOrEqual(0); expect(i, `${w}: first y is not the last letter`).toBeLessThan(w.length - 1); }
    for (const [w] of OU_BANK) expect(w.includes('ou'), w).toBe(true);
    for (const [w] of BANK) { expect(AVOID.has(w.toLowerCase()), w).toBe(false); expect(EXCLUDE, w).not.toContain(w.toLowerCase()); }
  });

  it('the answer is the bank word and every decoy is a non-word, over the whole bank', () => {
    const homophones = new Set(HOMOPHONE_SETS.flat());
    const seen = new Map<string, string>();
    for (const [word, sentence, decoys] of BANK) {
      expect(sentence.split('___').length, `${word}: exactly one gap`).toBe(2);
      expect(sentence.length, `${word}: sentence length`).toBeLessThanOrEqual(60);
      expect(sentence.toLowerCase().includes(word.toLowerCase()), `${word} leaks into its own sentence`).toBe(false);
      for (const w of sentence.toLowerCase().match(/[a-z']+/g)!) expect(AVOID.has(w) || EXCLUDE.includes(w), `${w} in ${word}'s sentence`).toBe(false);
      expect(decoys.length, word).toBeGreaterThanOrEqual(3);
      expect(new Set(decoys).size, `${word}: duplicate decoys`).toBe(decoys.length);
      for (const dc of decoys) {
        const l = dc.toLowerCase();
        expect(l, `${word}: decoy repeats the answer`).not.toBe(word.toLowerCase());
        expect(GAP_WORDS.has(l) || AVOID.has(l) || REAL_LOOKALIKES.has(l) || homophones.has(l) || EXCLUDE.includes(l), `${dc} is a real word`).toBe(false);
        for (const a of AVOID) expect(l.includes(a), `${dc} contains ${a}`).toBe(false);
        expect(seen.has(l), `${dc} is a decoy of ${seen.get(l)} too`).toBe(false);
        seen.set(l, word);
      }
    }
    for (const [, , decoys] of BANK.filter(r => r[0] === 'country')) for (const dc of decoys) expect(/^cu[^o]/.test(dc) || dc.includes('cuntr'), dc).toBe(false);
    const decoyPool = new Set([...seen.keys()]);
    for (const [w] of BANK) expect(decoyPool.has(w.toLowerCase()), `${w} is also someone's decoy`).toBe(false);
  });

  it('pins every answer and decoy a card can show, sorted, so a change arrives in a diff (#418)', () => {
    const all = BANK.flatMap(([w, , ds]) => [w, ...ds]).sort();
    expect(all).toMatchInlineSnapshot(`
      [
        "Eejipt",
        "Egipt",
        "Egypt",
        "Egypte",
        "chrystal",
        "countery",
        "countree",
        "countrey",
        "country",
        "coupel",
        "couple",
        "couradge",
        "courage",
        "courrage",
        "cousan",
        "cousen",
        "cousin",
        "couzin",
        "cristal",
        "crystal",
        "crystel",
        "cuple",
        "cupple",
        "curage",
        "cymbol",
        "doubel",
        "double",
        "dubbel",
        "dubble",
        "gim",
        "gimm",
        "gym",
        "jym",
        "liric",
        "lirric",
        "lyric",
        "lyrick",
        "mieth",
        "misterry",
        "mistery",
        "mith",
        "mysterie",
        "mystery",
        "myth",
        "mythe",
        "nourich",
        "nourish",
        "nourrish",
        "nurish",
        "piramid",
        "pirramid",
        "pyramid",
        "pyramyd",
        "simbol",
        "sistem",
        "sistum",
        "southen",
        "southern",
        "suthern",
        "sutherne",
        "symbal",
        "symbol",
        "system",
        "systum",
        "tipical",
        "tipicle",
        "touch",
        "toutch",
        "troubel",
        "trouble",
        "trubble",
        "trubel",
        "tuch",
        "tutch",
        "typical",
        "typicle",
        "yong",
        "young",
        "younge",
        "yung",
      ]
    `);
  });

  it('builds the ladder: ou with 2 bubbles, y with 3, both with 4, each card with a sentence and a say', () => {
    const kinds: Record<number, Set<string>> = { 1: new Set(), 2: new Set(), 3: new Set() };
    for (const d of [1, 2, 3] as Difficulty[]) for (let s = 1; s <= 400; s++) {
      const q = topic.gen(d, rng(s * 7 + d));
      const row = BANK.find(r => r[0] === q.answer)!;
      kinds[d].add(Y_BANK.includes(row) ? 'y' : 'ou');
      expect(q.prompt).toBe('Which spelling is right?');
      expect(q.options.length).toBe(d + 1);
      expect(new Set(q.options).size).toBe(q.options.length);
      expect(q.options).toContain(q.answer);
      expect(q.visual).toEqual({ type: 'sentence', text: row[1] });
      expect(q.say).toBe(`${q.answer}. ${row[1].replace('___', 'blank')}`);
      for (const o of q.options) if (o !== q.answer) expect(row[2]).toContain(o);
      expect(rLblProblem(q as { options: string[] }), q.answer).toBeNull();
    }
    expect([...kinds[1]]).toEqual(['ou']);
    expect([...kinds[2]]).toEqual(['y']);
    expect([...kinds[3]].sort()).toEqual(['ou', 'y']);
  });
});

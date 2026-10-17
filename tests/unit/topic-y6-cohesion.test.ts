import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { LINKERS, LINK_PAIRS, ELLIPSES } from '../../src/curriculum/year6-cohesion';
import { rLblProblem } from './helpers/r-lbl';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-cohesion')!;
const draws = (d: Difficulty, n = 300) => { const r = rng(1284 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
// Literal lexicons, written here and not imported, so the oracle never re-reads the module's own banks.
const REL: Record<string, string[]> = {
  contrast: ['on the other hand', 'in contrast', 'however'],
  consequence: ['as a consequence', 'as a result', 'therefore'],
  addition: ['furthermore', 'in addition', 'moreover'],
  example: ['for example', 'for instance'],
};
const OPPOSITES = [['quiet', 'noisy'], ['hot', 'cold'], ['early', 'late'], ['tidy', 'messy'], ['shallow', 'deep'], ['long', 'short']];
const CAUSES = [['rained', 'cancelled'], ['forgot', 'late'], ['broke', 'mended'], ['flat', 'dark'], ['practised', 'won'], ['skipped', 'hungry']];
const MEMBERS = [['fruit', 'apples'], ['birds', 'robins'], ['instruments', 'violin'], ['animals', 'dolphins'], ['vegetables', 'peas'], ['insects', 'ants']];
const LEX: Record<string, string[][]> = { contrast: OPPOSITES, consequence: CAUSES, example: MEMBERS };
const words = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, '').split(' ');
const has = (lex: string[][], a: string, b: string) => { const x = words(a), y = words(b); return lex.some(([p, q]) => (x.includes(p) && y.includes(q)) || (x.includes(q) && y.includes(p))); };
const Y5 = ['then', 'after that', 'firstly', 'later', 'nearby', 'secondly', 'afterwards', 'meanwhile'];
const relOf = (l: string) => Object.keys(REL).find(k => REL[k].includes(l))!;
/** The linkers a lettered card lists, by letter. */
const listedOf = (text: string) => Object.fromEntries([...text.matchAll(/^([A-D]) ([a-z ]+)$/gm)].map(m => [m[1], m[2]]));

describe('y6-cohesion (#1284)', () => {
  it('is registered once in Year 6 writing, as grammar, with a plain title', () => {
    expect(TOPICS.filter(t => t.id === 'y6-cohesion')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year6', subject: 'writing', strand: 'grammar', title: 'Linking Paragraphs' });
  });

  it('the linker bank equals the literal lexicon and holds no Year 5 device', () => {
    expect(Object.fromEntries(Object.entries(LINKERS).map(([k, v]) => [k, [...v]]))).toEqual(REL);
    for (const l of Object.values(REL).flat()) expect(Y5).not.toContain(l);
  });

  it('d1: every card lists one linker per relation, and the answer letter is the asked one', () => {
    const seen = new Set<string>();
    for (const c of draws(1)) {
      const m = c.prompt.match(/^Which linking phrase shows an? (\w+)\?/)!;
      const listed = listedOf((c.visual as { text: string }).text);
      expect(Object.keys(listed)).toEqual(['A', 'B', 'C', 'D']);
      expect(Object.values(listed).map(relOf).sort()).toEqual(['addition', 'consequence', 'contrast', 'example']);
      expect(relOf(listed[c.answer])).toBe(m[1]);
      expect([...c.options].sort()).toEqual(['A', 'B', 'C', 'D']);
      seen.add(m[1]);
    }
    expect(seen.size).toBe(4);
  });

  it('every passage row\'s relation is proved by a word pair in its lexicon and by none in the other two', () => {
    for (const [a, b, rel] of LINK_PAIRS) {
      expect(has(LEX[rel], a, b), `${a} ${b}`).toBe(true);
      for (const other of Object.keys(LEX).filter(k => k !== rel)) expect(has(LEX[other], a, b), `${a} ${b} vs ${other}`).toBe(false);
    }
    expect(LINK_PAIRS.length).toBeGreaterThanOrEqual(16);
    for (const rel of Object.keys(LEX)) expect(LINK_PAIRS.filter(r => r[2] === rel).length).toBeGreaterThanOrEqual(5);
  });

  it('d2: a passage card offers one contrast, one consequence and one example linker, never addition, and the answer fits', () => {
    for (const c of draws(2)) {
      const text = (c.visual as { text: string }).text, listed = listedOf(text);
      expect(Object.keys(listed)).toEqual(['A', 'B', 'C']);
      expect(Object.values(listed).map(relOf).sort()).toEqual(['consequence', 'contrast', 'example']);
      const [a, b] = text.split('\n')[0].split(' ___, ');
      const row = LINK_PAIRS.find(r => r[0] === a && r[1] === b)!;
      expect(row).toBeTruthy();
      expect(relOf(listed[c.answer])).toBe(row[2]);
      expect([...c.options].sort()).toEqual(['A', 'B', 'C']);
    }
  });

  it('every ellipsis row reconstructs to its full sentence, and no decoy does', () => {
    const strip = (s: string) => s.replace(/\s+/g, ' ').replace(/ ([.,])/g, '$1').trim();
    const rebuild = (full: string, w: string) => [...full.matchAll(new RegExp(`\\b${w}\\b`, 'g'))].map(m => strip(full.slice(0, m.index) + full.slice(m.index! + w.length)));
    for (const [short, missing, full, decoys] of ELLIPSES) {
      expect(rebuild(full, missing), short).toContain(short);
      for (const d of decoys) { expect(d).not.toBe(missing); expect(full.includes(d) && rebuild(full, d).includes(short), `${short} / ${d}`).toBe(false); }
    }
    expect(ELLIPSES.length).toBeGreaterThanOrEqual(10);
    expect(ELLIPSES.some(r => r[2] === 'She did it because she wanted to do it.')).toBe(true);
  });

  it('d3: half passage cards and half ellipsis cards, the answer being the missing words', () => {
    let ell = 0, pas = 0;
    for (const c of draws(3)) {
      if (c.prompt === 'Which words have been left out?') {
        ell++;
        const row = ELLIPSES.find(r => r[0] === (c.visual as { text: string }).text)!;
        expect(c.answer).toBe(row[1]);
        expect(c.options).toHaveLength(3);
        expect([...c.options].sort()).toEqual([row[1], ...row[3]].sort());
      } else { pas++; expect(c.prompt).toBe('Which linking phrase fits the gap?'); }
    }
    expect(ell).toBeGreaterThan(100); expect(pas).toBeGreaterThan(100);
  });

  it('answer letters are balanced within 10% at every difficulty', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const lettered = draws(d, 600).filter(c => /^[A-D]$/.test(c.answer));
      const letters = [...new Set(lettered.map(c => c.options.length).map(n => 'ABCD'.slice(0, n)))].pop()!.split('');
      for (const l of letters) expect(Math.abs(lettered.filter(c => c.answer === l).length / lettered.length - 1 / letters.length)).toBeLessThan(0.1);
    }
  });

  it('no bank word or option is a Year 5 device or on the avoid list, and labels fit a bubble', () => {
    const bank = [...Object.values(REL).flat(), ...LINK_PAIRS.flatMap(r => words(`${r[0]} ${r[1]}`)), ...ELLIPSES.flatMap(r => [r[1], ...r[3]])];
    for (const w of bank) { expect(AVOID.has(w), w).toBe(false); expect(Y5).not.toContain(w); }
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d, 100)) { expect(rLblProblem(c)).toBeNull(); expect(new Set(c.options).size).toBe(c.options.length); expect(c.options).toContain(c.answer); expect(c.say).not.toMatch(/ [A-D] [a-z]/); }
  });
});

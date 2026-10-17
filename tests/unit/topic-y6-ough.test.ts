import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID, GAP_WORDS } from '../../src/curriculum/util';
import { OUGH, EI_C } from '../../src/curriculum/year6-ough';
import { rLblProblem } from './helpers/r-lbl';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-ough')!;
const draws = (d: Difficulty, n = 300) => { const r = rng(1274 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const GROUPS: Record<string, string[]> = {
  ought: ['ought', 'bought', 'thought', 'nought', 'brought', 'fought'], rough: ['rough', 'tough', 'enough'], cough: ['cough'],
  though: ['though', 'although', 'dough'], through: ['through'], thorough: ['thorough', 'borough'], plough: ['plough', 'bough'],
};
const EI = ['deceive', 'conceive', 'receive', 'perceive', 'ceiling'], EXC = ['protein', 'caffeine', 'seize'];
const NEVER_RHYME = ['thorough', 'borough', 'cough'];
const groupOf = (w: string) => OUGH.find(r => r[0] === w)?.[1];
const lev = (a: string, b: string): number => {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return m[a.length][b.length];
};
const words = (s: string): string[] => s.toLowerCase().match(/[a-z]+/g) ?? [];
const isRhyme = (p: string) => p.startsWith('Which word rhymes with');

describe('y6-ough (#1274)', () => {
  it('is registered once in Year 6 writing, in the spelling strand', () => {
    expect(TOPICS.filter(t => t.id === 'y6-ough')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year6', subject: 'writing', strand: 'spelling' });
  });

  it('the bank holds every Appendix 1 p. 20 example word in the right sound group', () => {
    for (const [g, ws] of Object.entries(GROUPS)) for (const w of ws) expect(groupOf(w), w).toBe(g);
    expect(OUGH).toHaveLength(Object.values(GROUPS).flat().length);
    expect(EI_C.map(r => r[0])).toEqual([...EI, ...EXC]);
    expect(EI_C.filter(r => r[3]).map(r => r[0])).toEqual(EXC);
  });

  it('misspellings are unique non-words, at least one edit from the answer, and never crude', () => {
    const bank = new Set([...OUGH.map(r => r[0]), ...EI_C.map(r => r[0])]);
    const seen = new Set<string>();
    const rows: [string, string[]][] = [...OUGH.map((r): [string, string[]] => [r[0], r[3]]), ...EI_C.map((r): [string, string[]] => [r[0], r[2]])];
    for (const [w, wrong] of rows) {
      expect(new Set(wrong).size, w).toBe(3);
      for (const m of wrong) {
        expect(lev(m, w), m).toBeGreaterThanOrEqual(1);
        expect(bank.has(m), m).toBe(false); expect(GAP_WORDS.has(m), m).toBe(false); expect(seen.has(m), m).toBe(false);
        for (const a of AVOID) expect(m.includes(a), `${m} ~ ${a}`).toBe(false);
        seen.add(m);
      }
    }
    EI_C.forEach(r => expect(r[2][0], r[0]).toBe(r[0].replace('ei', 'ie')));
  });

  it('every sentence has one gap, fits 60 characters and avoids crude words', () => {
    for (const s of [...OUGH.map(r => r[2]), ...EI_C.map(r => r[1])]) {
      expect(s.split('_'), s).toHaveLength(2);
      expect(s.length, s).toBeLessThanOrEqual(60);
      for (const w of words(s)) expect(AVOID.has(w), w).toBe(false);
    }
  });

  it('the ladder: d1 uses the ought, rough and through groups, d2 adds every group and the ei words, d3 the exceptions only', () => {
    const answers = (d: Difficulty) => new Set(draws(d).filter(q => !isRhyme(q.prompt)).map(q => q.answer));
    for (const w of answers(1)) expect(['ought', 'rough', 'through']).toContain(groupOf(w)!);
    const a2 = answers(2);
    for (const w of [...Object.values(GROUPS).flat(), ...EI]) expect(a2.has(w), w).toBe(true);
    for (const w of EXC) expect(a2.has(w), w).toBe(false);
    for (const d of [1, 2] as Difficulty[]) for (const q of draws(d)) expect(EXC).not.toContain(q.answer);
    const a3 = answers(3);
    for (const w of EXC) expect(a3.has(w), w).toBe(true);
    for (const w of a3) expect(EXC, w).toContain(w);
    expect(draws(1).every(q => q.options.length === 3) && draws(2).every(q => q.options.length === 4) && draws(3).every(q => q.options.length === 4)).toBe(true);
  });

  it('d3 is half rhyme cards and half exception cards', () => {
    const n = draws(3, 600).filter(q => isRhyme(q.prompt)).length;
    expect(n).toBeGreaterThan(220); expect(n).toBeLessThan(380);
  });

  it('every rhyme card has exactly one option in the target’s group, and never thorough, borough or cough', () => {
    const cards = draws(3, 600).filter(q => isRhyme(q.prompt));
    const targets = new Set<string>();
    for (const q of cards) {
      const target = /rhymes with (\w+)\?/.exec(q.prompt)![1];
      targets.add(target);
      expect(NEVER_RHYME).not.toContain(target);
      expect(GROUPS[groupOf(target)!].filter(w => !NEVER_RHYME.includes(w)).length, target).toBeGreaterThanOrEqual(2);
      expect(q.options.filter(o => groupOf(o) === groupOf(target)), q.prompt).toHaveLength(1);
      expect(groupOf(String(q.answer))).toBe(groupOf(target));
      expect(q.answer).not.toBe(target);
      expect(q.options.some(o => o === target)).toBe(false);
      for (const o of q.options) expect(NEVER_RHYME, o).not.toContain(o);
      expect(words(q.say!)).not.toContain(String(q.answer));
    }
    expect(targets.has('through')).toBe(false);
    expect([...targets].sort()).toEqual(['although', 'bought', 'bough', 'brought', 'dough', 'enough', 'fought', 'nought', 'ought', 'plough', 'rough', 'though', 'thought', 'tough'].sort());
  });

  it('every ei-after-c card offers the ie swap as a decoy, and spelling cards never speak the answer', () => {
    for (const d of [2, 3] as Difficulty[]) for (const q of draws(d)) {
      if (isRhyme(q.prompt)) continue;
      expect(q.say!.match(/blank/g)).toHaveLength(1);
      expect(words(q.say!)).not.toContain(String(q.answer));
      if (EI.includes(String(q.answer)) || EXC.includes(String(q.answer))) expect(q.options, q.prompt).toContain(String(q.answer).replace('ei', 'ie'));
    }
  });

  it('no crude words anywhere on a card, and labels pass R-LBL', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      for (const w of [...words(q.prompt), ...q.options.map(String)]) expect(AVOID.has(w), w).toBe(false);
      expect(rLblProblem(q), q.prompt).toBeFalsy();
    }
  });
});

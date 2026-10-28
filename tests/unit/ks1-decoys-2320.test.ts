import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import { CONTRACTIONS, contractionDecoys } from '../../src/curriculum/year2';
import { daysDecoyPool } from '../../src/curriculum/year1';
import type { Difficulty } from '../../src/curriculum';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = (id: string) => TOPICS.find(x => x.id === id)!;
const N = 200;

describe('#2320 y1-days decoys are plausible letters', () => {
  it('never offers q, x, z, j, k or v for a gap, and matches vowel to vowel', () => {
    const t = topic('y1-days');
    for (const d of [1, 2] as Difficulty[]) {
      const r = rng(2320 + d);
      for (let i = 0; i < N; i++) {
        const q = t.gen(d, r);
        const decoys = q.options.filter(o => o !== q.answer);
        const vowel = 'aeiou'.includes(q.answer);
        for (const o of decoys) {
          expect('qxzjkv', `${q.prompt}: ${o}`).not.toContain(o);
          expect('aeiou'.includes(o), `${q.prompt}: ${o} same class as ${q.answer}`).toBe(vowel);
        }
      }
    }
  });
  it('every day and gap keeps at least three plausible decoys', () => {
    for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])
      for (let i = 1; i <= Math.min(4, day.length - 1); i++) expect(daysDecoyPool(day, i).length, `${day} ${i}`).toBeGreaterThanOrEqual(3);
  });
});

describe('#2320 y2-contractions decoys are real mistakes', () => {
  it('every bank entry has distinct decoys that are not the answer', () => {
    for (const [long, short] of CONTRACTIONS) {
      const ds = contractionDecoys(long, short, 5);
      expect(ds.length, short).toBeGreaterThanOrEqual(3);
      expect(new Set(ds).size).toBe(ds.length);
      expect(ds, short).not.toContain(short);
    }
  });
  it('for "we will" a decoy shares the last word, so it is not ruled out by the opening letter alone', () => {
    expect(contractionDecoys('we will', "we'll", 5)).toContain("I'll");
  });
  it('generated cards keep the answer among unique options', () => {
    const t = topic('y2-contractions');
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(2321 + d);
      for (let i = 0; i < N; i++) {
        const q = t.gen(d, r);
        expect(q.options).toContain(q.answer);
        expect(new Set(q.options).size).toBe(q.options.length);
      }
    }
  });
});

import { describe, it, expect } from 'vitest';
import { FACTS, OPINIONS, OPINION_MARKERS, OBVIOUS_MARKERS, hasMarker, wordsOf, y5FactOpinion } from '../../src/curriculum/year5-factopinion';
import { Y5_READING } from '../../src/curriculum/year5-reading';
import { AVOID } from '../../src/curriculum/util';

function seededRng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const EXCLUDE = new Set(['gay', 'queer', 'bitch', 'butt']);
const row = Y5_READING.find(t => t.id === 'y5-factopinion')!;

describe('y5-factopinion bank (#1178)', () => {
  it('has at least 30 of each, all within 44 characters and unique', () => {
    expect(FACTS.length).toBeGreaterThanOrEqual(30);
    expect(OPINIONS.length).toBeGreaterThanOrEqual(30);
    const all = [...FACTS, ...OPINIONS];
    expect(new Set(all).size).toBe(all.length);
    for (const s of all) expect(s.length, s).toBeLessThanOrEqual(44);
  });
  it('every opinion carries a marker and no fact does', () => {
    for (const o of OPINIONS) expect(hasMarker(o), o).toBe(true);
    for (const f of FACTS) expect(hasMarker(f), f).toBe(false);
  });
  it('the obvious markers are a subset, with enough opinions for d1', () => {
    for (const m of OBVIOUS_MARKERS) expect(OPINION_MARKERS).toContain(m);
    expect(OPINIONS.filter(o => hasMarker(o, OBVIOUS_MARKERS)).length).toBeGreaterThanOrEqual(8);
  });
  it('no bank word is in AVOID or the local EXCLUDE set', () => {
    for (const s of [...FACTS, ...OPINIONS]) for (const w of wordsOf(s)) {
      expect(AVOID.has(w), w).toBe(false);
      expect(EXCLUDE.has(w), w).toBe(false);
    }
  });
});

describe('y5-factopinion cards (#1178)', () => {
  it('d1 and d2 show one sentence with fact/opinion bubbles, the answer matching the bank', () => {
    for (const d of [1, 2] as const) for (let s = 1; s <= 80; s++) {
      const q = y5FactOpinion(d, seededRng(s));
      expect([...q.options].sort()).toEqual(['fact', 'opinion']);
      const text = (q.visual as { text: string }).text;
      expect(q.answer).toBe(FACTS.includes(text) ? 'fact' : 'opinion');
      expect(FACTS.includes(text) || OPINIONS.includes(text)).toBe(true);
      expect(q.anyOrder).toBeFalsy();
    }
  });
  it('d1 uses obvious markers and no comparison facts', () => {
    for (let s = 1; s <= 80; s++) {
      const text = (y5FactOpinion(1, seededRng(s)).visual as { text: string }).text;
      if (OPINIONS.includes(text)) expect(hasMarker(text, OBVIOUS_MARKERS), text).toBe(true);
      else expect(wordsOf(text), text).not.toContain('than');
    }
  });
  it('d3 is an any-order card: 2 targets, 1 decoy, targets are the asked kind', () => {
    for (let s = 1; s <= 80; s++) {
      const q = y5FactOpinion(3, seededRng(s));
      expect(q.anyOrder).toBe(true);
      expect([...q.options].sort()).toEqual(['A', 'B', 'C']);
      expect(q.sequence).toHaveLength(2);
      const lines = (q.visual as { text: string }).text.split('\n');
      expect(lines).toHaveLength(3);
      const wantOpinion = q.prompt === 'Slice every opinion';
      expect(wantOpinion || q.prompt === 'Slice every fact').toBe(true);
      for (const l of lines) {
        const letter = l[0], sentence = l.slice(3);
        const isTarget = q.sequence!.includes(letter);
        expect((wantOpinion ? OPINIONS : FACTS).includes(sentence), l).toBe(isTarget);
      }
    }
  });
  it('every difficulty reaches both answers; d2 reaches comparison facts and non-obvious opinions; d3 both prompts', () => {
    const texts = (d: 1 | 2) => Array.from({ length: 200 }, (_, i) => y5FactOpinion(d, seededRng(i + 1)));
    for (const d of [1, 2] as const) expect(new Set(texts(d).map(q => q.answer))).toEqual(new Set(['fact', 'opinion']));
    const d2 = texts(2).map(q => (q.visual as { text: string }).text);
    expect(d2.some(t => wordsOf(t).includes('than') && FACTS.includes(t))).toBe(true);
    expect(d2.some(t => OPINIONS.includes(t) && !hasMarker(t, OBVIOUS_MARKERS))).toBe(true);
    const prompts = new Set(Array.from({ length: 100 }, (_, i) => y5FactOpinion(3, seededRng(i + 1)).prompt));
    expect(prompts).toEqual(new Set(['Slice every opinion', 'Slice every fact']));
  });
  it('d3 lines are distinct sentences lettered A to C', () => {
    for (let s = 1; s <= 80; s++) {
      const lines = (y5FactOpinion(3, seededRng(s)).visual as { text: string }).text.split('\n');
      expect(lines.map(l => l.slice(0, 3))).toEqual(['A  ', 'B  ', 'C  ']);
      expect(new Set(lines).size).toBe(3);
    }
  });
  it('the row is wired: writing, year 5, sequenceFrom 3', () => {
    expect(row.subject).toBe('writing');
    expect(row.year).toBe('year5');
    expect(row.sequenceFrom).toBe(3);
  });
});

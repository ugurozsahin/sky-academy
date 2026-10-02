import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import {
  PERFECT_D1, PERFECT_D2, PERFECT_D3_AUX, PAST_MARKERS, PERFECT_MARKERS, VERBS, perfectAnswer, type PerfectRow,
} from '../../src/curriculum/year3-perfect';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y3-perfect')!;
const draws = (d: Difficulty, seed: number, n = 300) => { const r = rng(seed + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const sentenceOf = (q: { visual?: { type: string; text?: string } }) => q.visual!.text!;
const EXCLUDE = new Set(['gay', 'queer', 'bitch', 'butt']);
const sets: [string, readonly PerfectRow[]][] = [['d1', PERFECT_D1], ['d2', PERFECT_D2], ['d3 aux', PERFECT_D3_AUX]];
const all = [...PERFECT_D1, ...PERFECT_D2, ...PERFECT_D3_AUX];
const rowFor = (s: string) => all.find(r => r[0] === s)!;
const MARKERS = [...PAST_MARKERS, ...PERFECT_MARKERS];
const count = (s: string, m: string) => (s.match(new RegExp(`(^|[^a-z])${m}($|[^a-z])`, 'gi')) ?? []).length;

describe('y3-perfect (#1109)', () => {
  it('is registered once, in Year 3 writing', () => {
    expect(TOPICS.filter(t => t.id === 'y3-perfect')).toHaveLength(1);
    expect(topic.year).toBe('year3');
    expect(topic.subject).toBe('writing');
  });

  it('oracle: every frame holds exactly one time marker, the one its row names (#666)', () => {
    for (const [name, set] of sets) for (const [s, , , marker] of set) {
      expect(MARKERS, `${name}: ${s}`).toContain(marker);
      const found = MARKERS.filter(m => count(s, m) > 0);
      expect(found, `${name}: ${s}`).toEqual([marker]);
      expect(count(s, marker), s).toBe(1);
    }
  });

  it('every frame has one gap, is ≤60 characters, is unique and no past-marker frame sits in the aux set', () => {
    expect(new Set(all.map(r => r[0])).size).toBe(all.length);
    for (const [name, set] of sets) {
      expect(set.length, name).toBeGreaterThanOrEqual(8);
      for (const [s] of set) { expect(s.split('___'), s).toHaveLength(2); expect(s.length, s).toBeLessThanOrEqual(60); }
    }
    for (const [, , , m, kind] of PERFECT_D3_AUX) { expect(kind).toBe('a'); expect(PERFECT_MARKERS as readonly string[]).toContain(m); }
  });

  it('the answer follows the marker: past for a past marker, has/have + participle for a perfect one', () => {
    for (const row of [...PERFECT_D1, ...PERFECT_D2]) {
      const [, v, person, marker] = row;
      const [, past, part] = VERBS[v];
      const want = (PAST_MARKERS as readonly string[]).includes(marker) ? past : `${person === 's' ? 'has' : 'have'} ${part}`;
      expect(perfectAnswer(row), row[0]).toBe(want);
    }
  });

  it('the subject agrees with the auxiliary, in the answer and in a printed auxiliary', () => {
    for (const row of all) {
      const [s, , person, , kind] = row;
      if (kind === 'f') {
        const a = perfectAnswer(row);
        if (a.includes(' ')) expect(a.split(' ')[0], s).toBe(person === 's' ? 'has' : 'have');
        const subj = s.split(' ')[0].toLowerCase();
        if (['he', 'she'].includes(subj)) expect(person, s).toBe('s');
        if (['i', 'we', 'they'].includes(subj)) expect(person, s).toBe('p');
      } else {
        const aux = /\b(has|hasn't|have|haven't)\b/i.exec(s)![1].toLowerCase();
        expect(aux.startsWith('has'), s).toBe(person === 's');
      }
    }
  });

  it('aux frames use only verbs whose base, past and participle all differ, so no two bubbles match', () => {
    for (const [, v] of PERFECT_D3_AUX) expect(new Set(VERBS[v]).size, v).toBe(3);
  });

  it('every label stays short enough to fit a bubble (≤11 characters; `have finished` is the shape #1046 rejects)', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d, 1109_100))
      for (const o of q.options) expect(o.length, o).toBeLessThanOrEqual(11);
  });

  it('cards: the answer is derived from the row, option counts follow the ladder, hint and speech are set', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d, 1109_200)) {
      const row = rowFor(sentenceOf(q));
      expect(q.answer, sentenceOf(q)).toBe(perfectAnswer(row));
      expect(q.options).toContain(q.answer);
      expect(new Set(q.options).size).toBe(q.options.length);
      expect(q.options.length, `d${d} ${sentenceOf(q)}`).toBe(d === 1 ? 2 : 3);
      expect(q.say).toBe(sentenceOf(q).replace('___', 'blank'));
      expect(q.prompt).toBe(`Which form of "${VERBS[row[1]][0]}"?`);
      expect(q.hint).toBe('Look for the time word');
      expect(q.hintIsData).toBe(false);
    }
  });

  it('d2 offers a wrong-agreement decoy; aux cards offer participle, past and base', () => {
    for (const q of draws(2, 1109_300)) {
      const row = rowFor(sentenceOf(q)); const part = VERBS[row[1]][2];
      expect(q.options, sentenceOf(q)).toContain(`${row[2] === 's' ? 'have' : 'has'} ${part}`);
    }
    const aux = draws(3, 1109_400).filter(q => rowFor(sentenceOf(q))[4] === 'a');
    expect(aux.length).toBeGreaterThan(20);
    for (const q of aux) expect([...q.options].sort()).toEqual([...VERBS[rowFor(sentenceOf(q))[1]]].sort());
  });

  it('ladder: d1 draws only the d1 set; d3 mixes full and printed-auxiliary frames', () => {
    for (const q of draws(1, 1109_500)) expect(PERFECT_D1.some(r => r[0] === sentenceOf(q))).toBe(true);
    const kinds = new Set(draws(3, 1109_600).map(q => rowFor(sentenceOf(q))[4]));
    expect(kinds).toEqual(new Set(['f', 'a']));
  });

  it('no sentence word or label is in AVOID or the local EXCLUDE set', () => {
    for (const [name, set] of sets) for (const [s] of set)
      for (const w of s.toLowerCase().match(/[a-z]+/g) ?? []) {
        expect(AVOID.has(w), `${name}: ${s} (${w})`).toBe(false);
        expect(EXCLUDE.has(w), `${name}: ${s} (${w})`).toBe(false);
      }
    for (const forms of Object.values(VERBS)) for (const w of forms) { expect(AVOID.has(w)).toBe(false); expect(EXCLUDE.has(w)).toBe(false); }
  });
});

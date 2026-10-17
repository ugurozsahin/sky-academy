import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { SUBJUNCTIVES, STEM } from '../../src/curriculum/year6-subjunctive';
import { rLblProblem } from './helpers/r-lbl';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-subjunctive')!;
const draw = (d: Difficulty, n = 300) => { const r = rng(1280 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];
const text = (q: Question) => (q.visual as { text: string }).text;
const row = (q: Question) => SUBJUNCTIVES.find(r => r.text === text(q))!;
const words = (s: string) => s.toLowerCase().match(/[a-zé']+/g) ?? [];

describe('y6-subjunctive (#1280)', () => {
  it('is registered once in Year 6 writing, as grammar', () => { expect(TOPICS.filter(t => t.id === 'y6-subjunctive')).toHaveLength(1); expect(topic).toMatchObject({ year: 'year6', subject: 'writing', strand: 'grammar', title: 'The Subjunctive' }); });

  it('the bank holds 15–18 rows, each sentence once, with exactly one gap, and every kind is reachable', () => {
    expect(SUBJUNCTIVES.length).toBeGreaterThanOrEqual(15); expect(SUBJUNCTIVES.length).toBeLessThanOrEqual(18);
    expect(new Set(SUBJUNCTIVES.map(r => r.text)).size).toBe(SUBJUNCTIVES.length);
    for (const r of SUBJUNCTIVES) { expect(r.text.match(/_/g), r.text).toHaveLength(1); expect(new Set([r.answer, ...r.decoys]).size, r.text).toBe(4); }
    expect(new Set(SUBJUNCTIVES.map(r => r.kind))).toEqual(new Set(['were', 'mandative', 'inversion']));
  });

  it('every were sentence is counterfactual: its main clause has would (could and might also follow an open condition), and its if-clause is untrue on its face', () => {
    for (const r of SUBJUNCTIVES.filter(r => r.kind === 'were')) {
      expect(r.answer).toBe('were'); expect(words(r.text), r.text).toContain('would'); expect(r.text.startsWith('If ')).toBe(true);
      expect(words(r.text).some(w => ['could', 'might'].includes(w)), r.text).toBe(false);
    }
    // The if-clause: "you", an animal or a giant, an impossible age, the moon made of cheese, or the glossary's own example.
    const untrue = /^If (I|she|he|the moon|Zoë) _ (you|a bird|a giant|a fish|a cat|ten years older|made of cheese|the class president),/;
    for (const r of SUBJUNCTIVES.filter(r => r.kind === 'were')) expect(untrue.test(r.text), r.text).toBe(true);
  });

  it('every mandative answer is the verb\'s base form, and no decoy makes the sentence a statement of fact', () => {
    for (const r of SUBJUNCTIVES.filter(r => r.kind === 'mandative')) {
      expect(r.answer, r.text).toBe(r.base);
      expect(words(r.text).some(w => ['requires', 'insist', 'insists', 'suggest', 'ordered', 'demand', 'asks'].includes(w)), r.text).toBe(true);
      for (const d of r.decoys) expect(d.includes(' '), `${r.text}: "${d}" is one word, never a phrase such as "is leaving"`).toBe(false);
    }
  });

  it('the indicative form is always a decoy: was for were and inversion, the present -s or is/are form for a mandative', () => {
    for (const r of SUBJUNCTIVES) {
      if (r.kind === 'mandative') expect(r.decoys, r.text).toContain(r.base === 'be' ? 'is' : `${r.base}s`);
      else expect(r.decoys, r.text).toContain(r.kind === 'were' ? 'was' : 'Was');
    }
  });

  it('every card\'s prompt is the formal-writing stem, its say contains the stem and the sentence with "blank", and the answer is the row\'s', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(q.prompt).toBe(STEM); expect(q.say).toContain(STEM); expect(q.say).toContain('blank');
      expect(q.answer).toBe(row(q).answer); expect(q.options).toHaveLength(4); expect(q.options).toContain(q.answer);
      expect(q.visual?.type).toBe('sentence'); expect(rLblProblem(q), q.prompt).toBeNull();
    }
  });

  it('ladder: d1 only the I rows, d2 the other were rows and the mandatives, inversion only at d3', () => {
    for (const q of draw(1)) expect(row(q)).toMatchObject({ kind: 'were', person: 'I' });
    const kinds2 = new Set(draw(2).map(q => row(q).kind)); expect([...kinds2].sort()).toEqual(['mandative', 'were']);
    for (const q of draw(2)) if (row(q).kind === 'were') expect(row(q).person).toBe('other');
    expect(new Set(draw(3).map(q => row(q).kind))).toEqual(new Set(['were', 'mandative', 'inversion']));
  });

  it('crude words stay out of every sentence and option', () => {
    for (const r of SUBJUNCTIVES) for (const w of [...words(r.text), ...[r.answer, ...r.decoys].map(x => x.toLowerCase())]) expect(AVOID.has(w) || EXCLUDE.includes(w), w).toBe(false);
  });
});

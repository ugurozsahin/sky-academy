import { describe, it, expect } from 'vitest';
import { TOPICS, topicsFor, YEARS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { PHASE2, PHASE2B, PHASE3, PHASE5, SPLIT } from '../../src/curriculum/writing';

// Deterministic RNG (mulberry32)
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/** Independently evaluate simple arithmetic prompts like "7 + 5 = ?" / "? × 2 = 8" / "12 − ? = 5". */
function solve(prompt: string): number | null {
  const m = prompt.replace(/−/g, '-').match(/^(\?|\d+)\s*([+\-×÷])\s*(\?|\d+)\s*=\s*(\?|\d+)$/);
  if (!m) return null;
  const [, a, op, b, c] = m;
  const f = (x: number, y: number) => op === '+' ? x + y : op === '-' ? x - y : op === '×' ? x * y : x / y;
  if (c === '?') return f(+a, +b);
  if (a === '?') return op === '+' ? +c - +b : op === '-' ? +c + +b : op === '×' ? +c / +b : +c * +b;
  if (b === '?') return op === '+' ? +c - +a : op === '-' ? +a - +c : op === '×' ? +c / +a : +a / +c;
  return null;
}

const N = 150;

describe('topic registry', () => {
  it('has unique ids and every year has maths + writing', () => {
    const ids = TOPICS.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const y of YEARS) {
      expect(topicsFor(y.id, 'maths').length).toBeGreaterThanOrEqual(6);
      expect(topicsFor(y.id, 'writing').length).toBeGreaterThanOrEqual(3);
    }
  });
});

for (const topic of TOPICS) {
  describe(`${topic.year} / ${topic.title} (${topic.id})`, () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      it(`difficulty ${d}: ${N} valid questions`, () => {
        const r = rng(topic.id.length * 1000 + d);
        const seen = new Set<string>();
        for (let i = 0; i < N; i++) {
          const q: Question = topic.gen(d, r);
          expect(q.prompt.length).toBeGreaterThan(0);
          expect(q.answer.length).toBeGreaterThan(0);
          if (topic.mode !== 'tracing') {
            // answer present, options unique, sensible count
            expect(q.options).toContain(q.sequence ? q.sequence[0] : q.answer);
            expect(new Set(q.options).size).toBe(q.options.length);
            expect(q.options.length).toBeGreaterThanOrEqual(2);
            expect(q.options.length).toBeLessThanOrEqual(10);
            for (const o of q.options) expect(o.trim().length).toBeGreaterThan(0);
            if (q.sequence) {
              expect([q.sequence.join(''), q.sequence.join(','), q.sequence.join(' ')]).toContain(q.answer);
              for (const l of q.sequence) expect(q.options).toContain(l);
            }
          }
          // arithmetic prompts must be correct
          const s = solve(q.prompt);
          if (s !== null) expect(Number(q.answer), q.prompt).toBe(s);
          // numeric answers never negative, never absurd for KS1
          if (/^-?\d+$/.test(q.answer) && !q.sequence) { expect(Number(q.answer)).toBeGreaterThanOrEqual(0); expect(Number(q.answer)).toBeLessThanOrEqual(120); }
          seen.add(q.prompt + '|' + q.answer + '|' + JSON.stringify(q.visual ?? ''));
        }
        // variety: at least a handful of distinct questions
        expect(seen.size).toBeGreaterThan(3);
      });
    }
  });
}

describe('curriculum ranges', () => {
  it('Reception addition stays within 10', () => {
    const t = TOPICS.find(x => x.id === 'r-add')!; const r = rng(7);
    for (let i = 0; i < 300; i++) expect(Number(t.gen(3, r).answer)).toBeLessThanOrEqual(10);
  });
  it('Year 1 addition stays within 20', () => {
    const t = TOPICS.find(x => x.id === 'y1-add')!; const r = rng(8);
    for (let i = 0; i < 300; i++) expect(Number(t.gen(3, r).answer)).toBeLessThanOrEqual(20);
  });
  it('Year 2 tables only use 2, 5, 10', () => {
    const t = TOPICS.find(x => x.id === 'y2-tables')!; const r = rng(9);
    for (let i = 0; i < 300; i++) {
      const p = t.gen(3, r).prompt;
      const nums = p.match(/\d+/g)!.map(Number);
      expect(nums.some(n => [2, 5, 10].includes(n))).toBe(true);
    }
  });
  it('Balance the Scales: both sides are equal once ? is filled in, within the year range', () => {
    const evalSide = (s: string) => { // "3 + 4", "12 − 5", "2 × 5" (left to right, no precedence needed)
      const t = s.split(' '); let acc = Number(t[0]);
      for (let i = 1; i < t.length; i += 2) { const v = Number(t[i + 1]); acc = t[i] === '+' ? acc + v : t[i] === '−' ? acc - v : acc * v; }
      return acc;
    };
    for (const [id, max] of [['r-balance', 10], ['y1-balance', 20], ['y2-balance', 100]] as const) {
      const t = TOPICS.find(x => x.id === id)!; const r = rng(id.length);
      for (const d of [1, 2, 3] as Difficulty[]) for (let i = 0; i < 200; i++) {
        const q = t.gen(d, r);
        expect(q.visual?.type, id).toBe('scales');
        expect(q.prompt.split('?').length, q.prompt).toBe(2);
        const [l, rr] = q.prompt.replace('?', q.answer).split(' = ');
        expect(evalSide(l), q.prompt).toBe(evalSide(rr));
        expect(Number(q.answer)).toBeLessThanOrEqual(max);
        expect(Number(q.answer)).toBeGreaterThanOrEqual(0);
      }
    }
  });
  it('Story Sentences: word bubbles are unique, sentences are well formed, decoys stay out of the sentence, length by year', () => {
    for (const [id, maxWords] of [['r-sentence', 6], ['y1-sentence', 7], ['y2-sentence', 7]] as const) {
      const t = TOPICS.find(x => x.id === id)!; const r = rng(id.length + 3);
      for (const d of [1, 2, 3] as Difficulty[]) for (let i = 0; i < 100; i++) {
        const q = t.gen(d, r); const words = q.sequence!;
        expect(words.length, q.answer).toBeLessThanOrEqual(maxWords); expect(words.length).toBeGreaterThanOrEqual(3);
        expect(new Set(words).size, q.answer).toBe(words.length);                     // no repeated bubble label
        expect(q.answer).toMatch(/^[A-Z].*[.!?]$/);                                   // capital letter … end mark
        expect(q.options.length).toBeGreaterThan(words.length);                       // at least one decoy
        const bare = (w: string) => w.toLowerCase().replace(/[.!?,]/g, '');
        for (const o of q.options.filter(o => !words.includes(o))) expect(words.map(bare), q.answer).not.toContain(bare(o));
        expect(q.visual?.type).toBe(d === 1 || id === 'r-sentence' ? 'sentence' : 'word');   // shown vs. spoken-only
      }
    }
  });
  it('Sound Hunt: spoken words carry the sound where the hint says, no sound-alike decoys, nothing to read on the card', () => {
    const bank = [...PHASE2, ...PHASE2B, ...PHASE3, ...PHASE5, ...SPLIT];
    const family = (g: string) => bank.find(s => s[0] === g)![1];
    const has = (w: string, g: string, pos: string) => {
      if (g.length === 3 && g[1] === '-') return new RegExp(`${g[0]}[a-z]${g[2]}$`).test(w);      // split digraph: a_e
      return pos === 'start' ? w.startsWith(g) : pos === 'end' ? w.endsWith(g) : w.includes(g);
    };
    for (const id of ['r-soundhunt', 'y1-soundhunt']) {
      const t = TOPICS.find(x => x.id === id)!; const r = rng(id.length + 11);
      for (const d of [1, 2, 3] as Difficulty[]) for (let i = 0; i < 150; i++) {
        const q = t.gen(d, r);
        expect(q.visual).toBeUndefined(); expect(q.prompt).toBe('🔊 Listen!');
        const m = q.say!.match(/^Listen: (.+)\. Which sound do they (start with|end with|have in the middle)\?$/)!;
        expect(m, q.say).not.toBeNull();
        const pos = m[2] === 'start with' ? 'start' : m[2] === 'end with' ? 'end' : 'middle';
        const words = m[1].split(', '); expect(words).toHaveLength(3); expect(new Set(words).size).toBe(3);
        for (const w of words) expect(has(w.toLowerCase(), q.answer, pos), `${w} / ${q.answer}`).toBe(true);
        expect(q.listen!.split(' · ')).toEqual(words);
        expect(q.hint).toContain(pos);
        for (const o of q.options.filter(o => o !== q.answer)) expect(family(o), `${o} sounds like ${q.answer}`).not.toBe(family(q.answer));
        if (id === 'r-soundhunt' && d < 3) expect(q.answer.length <= 1 || q.answer === 'qu', q.answer).toBe(true);   // single sounds before digraphs
        expect(q.options.length).toBe(d === 1 ? 3 : 4);
      }
    }
  });
  it('Year 2 compare answers are correct signs', () => {
    const t = TOPICS.find(x => x.id === 'y2-compare')!; const r = rng(10);
    for (let i = 0; i < 200; i++) {
      const q = t.gen(3, r); const [a, b] = q.prompt.split(' ? ').map(Number);
      expect(q.answer).toBe(a < b ? '<' : a > b ? '>' : '=');
    }
  });
});

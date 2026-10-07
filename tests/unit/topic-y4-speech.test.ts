import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { STATEMENTS, QUESTIONS, EXCLAMATIONS } from '../../src/curriculum/year4-speech';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y4-speech')!;
const BANK = [...STATEMENTS, ...QUESTIONS, ...EXCLAMATIONS];
// `AVOID` is a gap-spelling denylist and lists no crude whole words (G13): a short local set too.
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];
const textOf = (q: { visual?: unknown }) => (q.visual as { text: string }).text;

/** The test's own rule, read off the card's shape rather than the bank's columns. */
function oracle(text: string): string {
  const gap = text.indexOf('_');
  const open = text.indexOf('“');
  if (gap < open) return ','; // gap after a reporting clause that comes first
  const speech = text.slice(open + 1, gap).replace(/^,\s*/, '');
  const question = /^(are|where|who|can|what|do) /i.test(speech);
  if (open > 0) return question ? '?' : '.'; // clause first: the end mark itself
  return question ? '?' : ','; // clause second
}

describe('y4-speech (#1167)', () => {
  it('is registered once in Year 4 grammar', () => {
    expect(TOPICS.filter(t => t.id === 'y4-speech')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year4', subject: 'writing', strand: 'grammar', title: 'Direct Speech' });
  });

  it('the bank is clean: hand-written, no excluded word, a question opens with a question word or auxiliary', () => {
    for (const [who, verb, words, end] of BANK) {
      for (const w of `${who} ${verb} ${words}`.toLowerCase().split(' ')) expect(AVOID.has(w) || EXCLUDE.includes(w), w).toBe(false);
      expect(words).not.toMatch(/[.?!,"“”]/);
      expect(/^(are|where|who|can|what|do) /i.test(words), words).toBe(end === '?');
    }
    expect(QUESTIONS.every(r => r[3] === '?') && STATEMENTS.every(r => r[3] === '.') && EXCLAMATIONS.every(r => r[3] === '!')).toBe(true);
  });

  it('the oracle gives the answer on every card at every difficulty', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (let s = 1; s <= 300; s++) {
      const q = topic.gen(d, rng(s * 13 + d));
      expect(q.answer, textOf(q)).toBe(oracle(textOf(q)));
    }
  });

  it('every card has one gap, two curly inverted commas, ASCII apostrophes and at most 60 characters', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (let s = 1; s <= 300; s++) {
      const text = textOf(topic.gen(d, rng(s * 17 + d)));
      expect(text.match(/_/g), text).toHaveLength(1);
      expect(text.match(/[“”]/g), text).toHaveLength(2);
      expect(text).not.toMatch(/[’‘"]/);
      expect(text.length, text).toBeLessThanOrEqual(60);
    }
  });

  it('d1 is the comma after the reporting clause with four bubbles; d2 is the end mark with three', () => {
    for (let s = 1; s <= 300; s++) {
      const q1 = topic.gen(1, rng(s));
      expect(q1.answer).toBe(',');
      expect([...q1.options].sort()).toEqual(['!', ',', '.', '?']);
      const q2 = topic.gen(2, rng(s + 1000));
      expect(textOf(q2)).toMatch(/_”$/);
      expect(['.', '?']).toContain(q2.answer);
      expect([...q2.options].sort()).toEqual([',', '.', '?']);
    }
  });

  it('every card offers a full stop as a decoy when it is not the answer; only d1 shows an exclamation', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (let s = 1; s <= 300; s++) {
      const q = topic.gen(d, rng(s * 5 + d));
      if (q.answer !== '.') expect(q.options).toContain('.');
      if (d > 1) { expect(q.options).not.toContain('!'); expect(textOf(q)).not.toContain('!'); }
    }
  });

  it('d3 reaches a statement with the reporting clause after it, whose answer is a comma', () => {
    const hit = (d: Difficulty) => { for (let s = 1; s <= 300; s++) { const t = textOf(topic.gen(d, rng(s * 3))); if (/^“[^?]*_” \w/.test(t) && topic.gen(d, rng(s * 3)).answer === ',' && !t.includes('?')) return true; } return false; };
    expect(hit(3)).toBe(true);
    expect(hit(2)).toBe(false);
  });
});

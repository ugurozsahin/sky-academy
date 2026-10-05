import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { Y3_STORY } from '../../src/curriculum/year3-calc';
import { cardBudgetProblem } from './helpers/card-budget';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y3-story')!;
const draws = (d: Difficulty, seed: number, n = 400) => { const r = rng(seed + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const num = (o: string) => Number(o.replace(/\D/g, ''));

/** Independent oracle: find the template the prompt is made of, apply its kind's operation, and name the adding slip. */
function parse(prompt: string, d: Difficulty) {
  for (const [unit, s1, s2, ask] of Y3_STORY.scale) {
    const m = prompt.match(new RegExp('^' + esc(s1).replace('#', unit ? `(\\d+) ${unit}` : '(\\d+)') + ' ' + esc(s2).replace('#', '(\\d+)') + ' ' + esc(ask) + '$'));
    if (m) return { unit, answer: +m[1] * +m[2], add: +m[1] + +m[2], k: +m[2] };
  }
  for (const [x, y, z] of Y3_STORY.pairs) {
    const m = prompt.match(new RegExp(`^(\\d+) ${x} and (\\d+) ${y}\\. How many ${z}\\?$`)), inv = prompt.match(new RegExp(`^(\\d+) ${z} from (\\d+) ${x}\\. How many ${y}\\?$`));
    if (m) return { unit: '', answer: +m[1] * +m[2], add: +m[1] + +m[2], k: 0 };
    if (inv) return { unit: '', answer: +inv[1] / +inv[2], add: +inv[1] - +inv[2], k: 0 };
  }
  for (const [thing, who, ask] of Y3_STORY.share) {
    const m = prompt.match(new RegExp(`^(\\d+) ${thing} shared equally between (\\d+) ${who}\\. ${esc(ask)}$`));
    if (m) return { unit: '', answer: +m[1] / +m[2], add: +m[1] - +m[2], k: 0, rem: +m[1] % +m[2] };
  }
  throw new Error(`no template matches (d${d}): ${prompt}`);
}

describe('y3-story (#1089)', () => {
  it('is registered once, in Year 3, directly after y3-multiply', () => {
    expect(TOPICS.filter(t => t.id === 'y3-story')).toHaveLength(1);
    expect(topic.year).toBe('year3');
    const ids = TOPICS.filter(t => t.id.startsWith('y3-')).map(t => t.id);
    expect(ids.indexOf('y3-story')).toBe(ids.indexOf('y3-multiply') + 1);
  });

  it('the bank holds at most 12 templates, one # per sentence', () => {
    expect(Y3_STORY.scale.length + Y3_STORY.pairs.length + Y3_STORY.share.length).toBeLessThanOrEqual(12);
    for (const [, s1, s2] of Y3_STORY.scale) { expect(s1.match(/#/g)).toHaveLength(1); expect(s2.match(/#/g)).toHaveLength(1); }
  });

  it('oracle: every answer is the template\'s operation, whole, ≤ 100, with no remainder', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d, 1089_100)) {
      const { unit, answer, rem } = parse(c.prompt, d);
      expect(c.answer, c.prompt).toBe(unit ? `${answer} ${unit}` : `${answer}`);
      expect(Number.isInteger(answer) && answer <= 100, c.prompt).toBe(true);
      expect(rem ?? 0, c.prompt).toBe(0);
      expect(new Set(c.options).size, c.prompt).toBe(4);
      expect(c.options.filter(o => o === c.answer), c.prompt).toHaveLength(1);
    }
  });

  it('the adding slip is an option on every card where it differs from the answer', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d, 1089_200)) {
      const { unit, answer, add } = parse(c.prompt, d);
      if (add !== answer && add >= 0) expect(c.options, c.prompt).toContain(unit ? `${add} ${unit}` : `${add}`);
    }
  });

  it('measure cards carry the unit on every bubble, count cards on none', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d, 1089_300)) {
      const { unit } = parse(c.prompt, d);
      for (const o of c.options) expect(o, c.prompt).toMatch(unit ? new RegExp(`^\\d+ ${unit}$`) : /^\d+$/);
      for (const o of c.options) expect(num(o), c.prompt).toBeLessThanOrEqual(100);
    }
  });

  it('the ladder: d1 scales by 2, 3, 4, 5, 10; d2 pairs and shares; d3 scales by 8 and asks the inverse', () => {
    expect(new Set(draws(1, 1089_400).map(c => parse(c.prompt, 1).k))).toEqual(new Set([2, 3, 4, 5, 10]));
    for (const c of draws(2, 1089_500)) expect(parse(c.prompt, 2).k, c.prompt).toBe(0);
    const d3 = draws(3, 1089_600);
    for (const c of d3) { const k = parse(c.prompt, 3).k; expect([0, 8], c.prompt).toContain(k); }
    expect(d3.some(c => / from \d+ /.test(c.prompt))).toBe(true);
  });

  it('every card has its own say, no digit-symbol maths, and every prompt fits the card (#1051)', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d, 1089_700)) {
      expect(c.say, c.prompt).toBeTruthy();
      expect(c.say, c.prompt).not.toMatch(/\b(cm|g|m)\b|\d/);
      expect(cardBudgetProblem(c), c.prompt).toBeNull();
    }
  });

  it('distractors: ≤ 30 % unique units digit or leading digit at every difficulty (#1058)', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const s = leakShares(topic.gen, d);
      expect(s.units, `d${d} units`).toBeLessThanOrEqual(0.3);
      expect(s.leading, `d${d} leading`).toBeLessThanOrEqual(0.3);
    }
  });
});

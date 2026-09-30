import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { parseNum } from '../../src/curriculum/ks2num';

// Deterministic RNG (mulberry32), same construction `curriculum.test.ts` uses.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y3-count')!;
const DRAWS = 400;
const num = (label: string) => parseNum(label)!.v;

/** Independent oracle: re-derive a run card's expected "?" from its OTHER three terms, never from the
 *  generator's own logic (#1050's own oracle description). */
function checkRunCard(prompt: string, answer: string) {
  const parts = prompt.replace(/\s*=\s*\?$/, '').split(', ');
  expect(parts, prompt).toHaveLength(4);
  const gapIndex = parts.indexOf('?');
  expect(gapIndex, prompt).toBeGreaterThanOrEqual(0);
  const known = [0, 1, 2, 3].filter(i => i !== gapIndex);
  // Any two known terms fix the step (they need not be index-adjacent when the gap sits between them).
  const step = (num(parts[known[1]]) - num(parts[known[0]])) / (known[1] - known[0]);
  expect(Number.isInteger(step), prompt).toBe(true);
  expect([4, 8, 50, 100], prompt).toContain(Math.abs(step));
  const base = num(parts[known[0]]) - known[0] * step;
  // every known term must agree with the single common step (same sign throughout)
  for (const i of known) expect(num(parts[i]), prompt).toBe(base + i * step);
  expect(num(answer), prompt).toBe(base + gapIndex * step);
}

/** Independent oracle for the "N more/less than BASE" card kind. */
function checkMoreOrLessCard(prompt: string, answer: string) {
  const m = prompt.match(/^(\d+) (more|less) than ([\d,]+) = \?$/);
  expect(m, prompt).toBeTruthy();
  const [, amtStr, dir, baseStr] = m!;
  const amt = Number(amtStr), base = num(baseStr);
  expect(num(answer), prompt).toBe(dir === 'more' ? base + amt : base - amt);
}

describe('y3-count (#1050)', () => {
  it('every card is a run (four comma-joined terms, one "?") or a more/less phrase, and the oracle agrees with the answer', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(1050_000 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        if (q.prompt.includes(',')) checkRunCard(q.prompt, q.answer);
        else checkMoreOrLessCard(q.prompt, q.answer);
      }
    }
  });

  it('d1 runs only ever count in 50s or 100s, always asking the next (last) term', () => {
    const r = rng(1050_100);
    for (let i = 0; i < DRAWS; i++) {
      const q = topic.gen(1, r);
      if (!q.prompt.includes(',')) continue;
      const parts = q.prompt.replace(/\s*=\s*\?$/, '').split(', ');
      expect(parts.indexOf('?'), q.prompt).toBe(3);
      const step = num(parts[1]) - num(parts[0]);
      expect([50, 100], q.prompt).toContain(step);
    }
  });

  it('d1 more/less cards ask for 10, and never cross a hundred boundary', () => {
    const r = rng(1050_200);
    for (let i = 0; i < DRAWS; i++) {
      const q = topic.gen(1, r);
      if (q.prompt.includes(',')) continue;
      const m = q.prompt.match(/^(\d+) (more|less) than ([\d,]+) = \?$/)!;
      expect(Number(m[1]), q.prompt).toBe(10);
      const base = num(m[3]);
      const answer = num(q.answer);
      expect(Math.floor(base / 100), q.prompt).toBe(Math.floor(answer / 100));
    }
  });

  it('d2 more/less cards ask for 100, and d2 runs only ever ask the next (last) term', () => {
    const r = rng(1050_300);
    for (let i = 0; i < DRAWS; i++) {
      const q = topic.gen(2, r);
      if (q.prompt.includes(',')) {
        const parts = q.prompt.replace(/\s*=\s*\?$/, '').split(', ');
        expect(parts.indexOf('?'), q.prompt).toBe(3);
        continue;
      }
      const m = q.prompt.match(/^(\d+) (more|less) than ([\d,]+) = \?$/)!;
      expect(Number(m[1]), q.prompt).toBe(100);
    }
  });

  it('d3 runs may count back (descending) and may ask a term inside the run, not only the last', () => {
    const r = rng(1050_400);
    let sawDescending = false, sawInside = false;
    for (let i = 0; i < DRAWS; i++) {
      const q = topic.gen(3, r);
      if (!q.prompt.includes(',')) continue;
      const parts = q.prompt.replace(/\s*=\s*\?$/, '').split(', ');
      const known = [0, 1, 2, 3].filter(idx => parts[idx] !== '?');
      if (num(parts[known[1]]) < num(parts[known[0]])) sawDescending = true;
      if (parts.indexOf('?') !== 3) sawInside = true;
    }
    expect(sawDescending, 'expected at least one descending (counting-back) run over 400 d3 draws').toBe(true);
    expect(sawInside, 'expected at least one non-final gap over 400 d3 draws').toBe(true);
  });

  it('every answer and option stays within 0–1,099, options are unique, and the answer is among them', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(1050_500 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        expect(q.options, q.prompt).toHaveLength(4);
        expect(new Set(q.options).size, q.prompt).toBe(4);
        expect(q.options, q.prompt).toContain(q.answer);
        for (const label of [q.answer, ...q.options]) {
          const v = num(label);
          expect(v, `${q.prompt} option "${label}"`).toBeGreaterThanOrEqual(0);
          expect(v, `${q.prompt} option "${label}"`).toBeLessThanOrEqual(1099);
        }
      }
    }
  });

  it('answers/options are comma-formatted (fmt), never a bare 4+-digit run of digits', () => {
    const r = rng(1050_600);
    for (let i = 0; i < DRAWS; i++) {
      const q = topic.gen(3, r);
      for (const label of [q.answer, ...q.options]) expect(label, q.prompt).not.toMatch(/\d{4,}/);
    }
  });
});

describe('Year 3 strand modules (#1050): import direction', () => {
  const dir = fileURLToPath(new URL('../../src/curriculum', import.meta.url));
  const year3Files = readdirSync(dir).filter(f => f.startsWith('year3-'));

  it('at least the nine strand modules plus year3-topics.ts exist', () => {
    expect(year3Files.length).toBeGreaterThanOrEqual(10);
  });

  it('no year3-*.ts file imports another year\'s module (reception/year1/year2*/year[4-6]-*)', () => {
    const forbidden = /from ['"]\.\/(reception|year1|year2[-/a-z]*|year[4-6]-[a-z-]*)['"]/;
    for (const f of year3Files) {
      const src = readFileSync(`${dir}/${f}`, 'utf8');
      expect(src, f).not.toMatch(forbidden);
    }
  });
});

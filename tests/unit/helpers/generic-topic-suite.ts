import { describe, it, expect } from 'vitest';
import { YEARS } from '../../../src/curriculum';
import type { Difficulty, Question, Topic } from '../../../src/curriculum';
import { isKs2 } from '../../../src/curriculum/key-stage';
import { parseNumericAnswer } from './numeric-answer';
import { arithmeticCheck } from './ks2-oracle';

// The per-topic structural loop (#1050), moved out of `curriculum.test.ts` unchanged so each year's topics can run
// in a file of their own (parallel Vitest workers): `curriculum.test.ts` runs it over EYFS/KS1, `curriculum-y3.test.ts`
// over Year 3. A topic runs in exactly one of them.

// Deterministic RNG (mulberry32)
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/** A build card's template (#1059) with its `_` slots filled by `sequence`, in order. */
function fillTemplate(template: string, sequence: readonly string[]): string {
  let i = 0;
  return Array.from(template).map(ch => ch === '_' ? sequence[i++] : ch).join('');
}

const N = 150;

/** The `sequence`/`build`/`anyOrder` structure of one card (#918, #1059). */
function checkSequence(q: Question & { sequence: string[] }): void {
  if (q.build) {
    expect((q.build.template.match(/_/g) ?? []).length, q.prompt).toBe(q.sequence.length);
    expect(q.answer, q.prompt).toBe(fillTemplate(q.build.template, q.sequence));
  } else {
    expect([q.sequence.join(''), q.sequence.join(','), q.sequence.join(' ')]).toContain(q.answer);
  }
  for (const l of q.sequence) expect(q.options).toContain(l);
  // #918: an any-order card's targets (`sequence`) are canonically sorted, its answer is their
  // comma join, it has at least 2 targets, and at least 1 decoy beyond them (`options` is already
  // asserted unique above, so a target sharing a label with a decoy would already have failed that).
  if (q.anyOrder) {
    expect(q.sequence.length, q.prompt).toBeGreaterThanOrEqual(2);
    expect(q.options.length, q.prompt).toBeGreaterThan(q.sequence.length);
    const sorted = [...q.sequence].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    expect(q.sequence, q.prompt).toEqual(sorted);
    expect(q.answer, q.prompt).toBe(sorted.join(','));
    // #918 round 2: a duplicate target label collapses in `Session.hit()`'s `slicedTargets` Set
    // while `q.sequence.length` still counts it, so the question never reaches its `'correct'`
    // threshold — a silent, permanent softlock. `anyOrderQ()` already refuses this at construction;
    // this is the backstop for a hand-built card that skips the builder.
    expect(new Set(q.sequence).size, q.prompt).toBe(q.sequence.length);
  }
}

export function genericTopicSuite(topics: readonly Topic[]): void {
for (const topic of topics) {
  const year = YEARS.find(y => y.id === topic.year)!;
  const maxAnswer = year.maxAnswer;   // NC answer ceiling for this year
  const minAnswer = year.minAnswer ?? 0;   // NC answer floor for this year (#1042)
  describe(`${topic.year} / ${topic.title} (${topic.id})`, () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      it(`difficulty ${d}: ${N} valid questions`, () => {
        const r = rng(topic.id.length * 1000 + d);
        const seen = new Set<string>();
        for (let i = 0; i < N; i++) {
          const q: Question = topic.gen(d, r);
          expect(q.prompt.length).toBeGreaterThan(0);
          expect(q.answer.length).toBeGreaterThan(0);
          // #1059: `build` implies `sequence` (types.ts) — checked outside the `if (q.sequence)` gate below
          // so a generator that sets `build` and forgets `sequence` cannot hide inside it: `promptHTML`
          // (`src/ui/hud.ts`) checks `!q.sequence` first and would silently render the plain-prompt branch,
          // dropping the digit-slot UI with nothing else noticing.
          if (q.build) expect(q.sequence, q.prompt).toBeDefined();
          // #918: `anyOrder` is legal only alongside `sequence` (types.ts) — checked outside the
          // `if (q.sequence)` gate below, same as `build` above, so a generator that sets `anyOrder`
          // and forgets `sequence` cannot hide inside it and silently degrade to plain single-answer
          // matching (`Session` reads `q.anyOrder` only inside `if (q.sequence)` gates).
          if (q.anyOrder) expect(q.sequence, q.prompt).toBeDefined();
          if (topic.input !== 'tracing') {
            // answer present, options unique, sensible count
            expect(q.options).toContain(q.sequence ? q.sequence[0] : q.answer);
            expect(new Set(q.options).size).toBe(q.options.length);
            expect(q.options.length).toBeGreaterThanOrEqual(2);
            expect(q.options.length).toBeLessThanOrEqual(10);
            for (const o of q.options) expect(o.trim().length).toBeGreaterThan(0);
            if (q.sequence) checkSequence(q as Question & { sequence: string[] });
          }
          // arithmetic prompts must be correct — a KS2 topic tries the exact ks2Solve oracle first
          // (decimals, fractions, brackets, percentages, one-step letter equations), falling back to
          // solve()'s bare-number check when it does not recognise the form (#1045)
          const arith = arithmeticCheck(isKs2(topic.year), q.prompt, q.answer);
          if (arith !== null) expect(arith, q.prompt).toBe(true);
          // numeric answers stay within the year's range — never absurd, never below its floor (0 for KS1)
          if (!q.sequence) {
            const n = parseNumericAnswer(q.answer);
            if (n !== null) { expect(n, q.prompt).toBeGreaterThanOrEqual(minAnswer); expect(n, q.prompt).toBeLessThanOrEqual(maxAnswer); }
          }
          seen.add(q.prompt + '|' + q.answer + '|' + JSON.stringify(q.visual ?? ''));
        }
        // variety: at least a handful of distinct questions
        expect(seen.size).toBeGreaterThan(3);
      });
    }
  });
}
}

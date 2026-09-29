// #981: y1-story "Story Sums" — the first problem-in-context topic in the game, in the manner of the Charts
// rail (curriculum.test.ts:1417): every oracle re-derived from the card's own visual, never from the table
// the generator itself reads, so a future edit that breaks the story can't also certify itself green.
import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y1-story')!;
const N = 150;
const DIFFICULTIES: Difficulty[] = [1, 2, 3];

describe('y1-story (#981): one-step Year 1 problems in a spoken story', () => {
  it('the oracle holds on every sampled card: the answer re-derives from the visual, not the prompt text', () => {
    for (const d of DIFFICULTIES) {
      for (let i = 0; i < N; i++) {
        const q = topic.gen(d, rng(981 + d * 10_000 + i));
        const v = q.visual;
        if (!v || v.type !== 'objects') throw new Error(`expected an objects visual: ${q.prompt}`);
        const answer = Number(q.answer);
        if (v.n2 === undefined) {
          // missing-part: the visual only ever shows the starting total, so the oracle re-derives the
          // "left" count from the prompt itself — the one number the visual cannot carry.
          const nums = q.prompt.match(/\d+/g)!.map(Number);
          expect(v.n - nums[1], q.prompt).toBe(answer);
        } else {
          expect(v.n + v.n2, q.prompt).toBe(answer);
        }
      }
    }
  });

  it('every answer and decoy is within 0–20', () => {
    for (const d of DIFFICULTIES) {
      for (let i = 0; i < N; i++) {
        const q = topic.gen(d, rng(1981 + d * 10_000 + i));
        expect(q.options.length, q.prompt).toBeGreaterThanOrEqual(3);
        for (const o of q.options) {
          const n = Number(o);
          expect(n, `${q.prompt} option ${o}`).toBeGreaterThanOrEqual(0);
          expect(n, `${q.prompt} option ${o}`).toBeLessThanOrEqual(20);
        }
      }
    }
  });

  it('every number written in the prompt or say is 2 or more — no card says "1 ducks"', () => {
    for (const d of DIFFICULTIES) {
      for (let i = 0; i < N; i++) {
        const q = topic.gen(d, rng(2981 + d * 10_000 + i));
        for (const s of [q.prompt, q.say]) {
          for (const n of (s ?? '').match(/\d+/g) ?? []) expect(Number(n), s!).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it('every card has a say that reads the whole story, and every prompt is 65 characters or fewer', () => {
    for (const d of DIFFICULTIES) {
      for (let i = 0; i < N; i++) {
        const q = topic.gen(d, rng(3981 + d * 10_000 + i));
        expect(q.say, q.prompt).toBeTruthy();
        expect(q.say, q.prompt).toBe(q.prompt);
        expect(q.prompt.length, q.prompt).toBeLessThanOrEqual(65);
      }
    }
  });

  it('d1 stays within 10 and never draws the missing-part form', () => {
    for (let i = 0; i < N; i++) {
      const q = topic.gen(1, rng(4981 + i));
      const v = q.visual;
      if (!v || v.type !== 'objects') throw new Error(`expected an objects visual: ${q.prompt}`);
      expect(v.n2, q.prompt).toBeDefined();
      expect(v.n, q.prompt).toBeLessThanOrEqual(10);
      expect(Math.abs(v.n2!), q.prompt).toBeLessThanOrEqual(10);
    }
  });

  it('d3 genuinely draws the missing-part form (visual carries no n2) at least once', () => {
    let sawMissing = false;
    for (let i = 0; i < N; i++) {
      const q = topic.gen(3, rng(5981 + i));
      const v = q.visual;
      if (v && v.type === 'objects' && v.n2 === undefined) sawMissing = true;
    }
    expect(sawMissing).toBe(true);
  });

  it('d2 and d3 reach into the 11–20 range, not just d1\'s 0–10 span', () => {
    let sawAboveTen = false;
    for (const d of [2, 3] as Difficulty[]) {
      for (let i = 0; i < N; i++) {
        const q = topic.gen(d, rng(6981 + d * 10_000 + i));
        if (Number(q.answer) > 10) sawAboveTen = true;
      }
    }
    expect(sawAboveTen).toBe(true);
  });
});

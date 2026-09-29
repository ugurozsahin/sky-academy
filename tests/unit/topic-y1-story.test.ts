// #981: y1-story "Story Sums" — the first problem-in-context topic in the game, in the manner of the Charts
// rail (curriculum.test.ts:1417): every oracle re-derived from the card's own visual, never from the table
// the generator itself reads, so a future edit that breaks the story can't also certify itself green.
import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { Y1_STORY_BANK } from '../../src/curriculum/year1';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y1-story')!;
const N = 150;
const DIFFICULTIES: Difficulty[] = [1, 2, 3];

/**
 * add/take-away always end "How many now?"; the missing-part form's question is instead the bank's own
 * `leave` phrase ("How many fly away?" etc.), which never reads "now" — a stable, content-based way to tell
 * the three kinds apart in a test without depending on how many digits happen to appear elsewhere in the
 * prompt (review finding: the prompt's own digit positions are not a safe thing to key an oracle on).
 */
const isMissingPart = (prompt: string) => !prompt.endsWith('How many now?');

describe('y1-story (#981): one-step Year 1 problems in a spoken story', () => {
  it('the oracle holds on every sampled card: the answer re-derives from the visual', () => {
    for (const d of DIFFICULTIES) {
      for (let i = 0; i < N; i++) {
        const q = topic.gen(d, rng(981 + d * 10_000 + i));
        const v = q.visual;
        if (!v || v.type !== 'objects') throw new Error(`expected an objects visual: ${q.prompt}`);
        expect(v.n2, q.prompt).toBeDefined();
        const answer = Number(q.answer);
        if (isMissingPart(q.prompt)) {
          // The picture crosses out exactly the unknown "eaten" group (review finding), so the answer is the
          // size of that crossed-out group, not the remaining count `v.n + v.n2` add/take-away derive it as.
          expect(-v.n2!, q.prompt).toBe(answer);
        } else {
          expect(v.n + v.n2!, q.prompt).toBe(answer);
        }
      }
    }
  });

  it('every card draws the exact option count its difficulty promises (2 decoys at d1, 3 at d2/d3)', () => {
    for (const d of DIFFICULTIES) {
      for (let i = 0; i < N; i++) {
        const q = topic.gen(d, rng(1981 + d * 10_000 + i));
        expect(q.options.length, q.prompt).toBe(d === 1 ? 3 : 4);
      }
    }
  });

  it('every answer and decoy is within 0–20', () => {
    for (const d of DIFFICULTIES) {
      for (let i = 0; i < N; i++) {
        const q = topic.gen(d, rng(2981 + d * 10_000 + i));
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
        const q = topic.gen(d, rng(3981 + d * 10_000 + i));
        for (const s of [q.prompt, q.say]) {
          for (const n of (s ?? '').match(/\d+/g) ?? []) expect(Number(n), s!).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it('every card has a say that reads the whole story, and every prompt is 65 characters or fewer', () => {
    for (const d of DIFFICULTIES) {
      for (let i = 0; i < N; i++) {
        const q = topic.gen(d, rng(4981 + d * 10_000 + i));
        expect(q.say, q.prompt).toBeTruthy();
        expect(q.say, q.prompt).toBe(q.prompt);
        expect(q.prompt.length, q.prompt).toBeLessThanOrEqual(65);
      }
    }
  });

  /**
   * Exhaustive, not sampled (review finding: 150 fixed seeds happen to pass without ever landing on the true
   * worst case — the boundary is exactly 65, with no margin). Every bank entry × every achievable (a, b/left)
   * pair per kind is small enough to enumerate directly against the generator's own three templates — driving
   * the real bank `y1Story` reads, per `open-pr`'s "sweep the class" method, not a stand-in for it.
   */
  it('the 65-character cap holds over the whole reachable space, not just the seeds sampled above', () => {
    let max = 0, worst = '';
    const consider = (s: string) => { if (s.length > max) { max = s.length; worst = s; } };
    for (const bank of Y1_STORY_BANK) {
      for (const maxN of [10, 20]) {   // d1's max is 10; d2/d3's is 20
        for (let a = 2; a <= maxN - 2; a++) {
          for (let b = 2; b <= maxN - a; b++) {
            consider(`${a} ${bank.noun} ${bank.place}. ${b} ${bank.join}. How many now?`);   // add
          }
        }
        for (let a = 4; a <= maxN; a++) {
          for (let b = 2; b <= a - 2; b++) {
            consider(`${a} ${bank.noun} ${bank.place}. ${b} ${bank.leave}. How many now?`);        // take-away
            consider(`${a} ${bank.noun} ${bank.place}. ${b} are left. How many ${bank.leave}?`);   // missing-part
          }
        }
      }
    }
    expect(max, worst).toBeLessThanOrEqual(65);
  });

  it('d1 stays within 10 and never draws the missing-part form', () => {
    for (let i = 0; i < N; i++) {
      const q = topic.gen(1, rng(5981 + i));
      expect(isMissingPart(q.prompt), q.prompt).toBe(false);
      const v = q.visual;
      if (!v || v.type !== 'objects') throw new Error(`expected an objects visual: ${q.prompt}`);
      expect(v.n, q.prompt).toBeLessThanOrEqual(10);
      expect(Math.abs(v.n2!), q.prompt).toBeLessThanOrEqual(10);
    }
  });

  it('d2 never draws the missing-part form either — it is d3-only', () => {
    for (let i = 0; i < N; i++) {
      const q = topic.gen(2, rng(6981 + i));
      expect(isMissingPart(q.prompt), q.prompt).toBe(false);
    }
  });

  it('d3 genuinely draws the missing-part form at least once', () => {
    let sawMissing = false;
    for (let i = 0; i < N; i++) {
      const q = topic.gen(3, rng(7981 + i));
      if (isMissingPart(q.prompt)) sawMissing = true;
    }
    expect(sawMissing).toBe(true);
  });

  it('d2 and d3 reach into the 11–20 range, not just d1\'s 0–10 span', () => {
    let sawAboveTen = false;
    for (const d of [2, 3] as Difficulty[]) {
      for (let i = 0; i < N; i++) {
        const q = topic.gen(d, rng(8981 + d * 10_000 + i));
        if (Number(q.answer) > 10) sawAboveTen = true;
      }
    }
    expect(sawAboveTen).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { createFactLog, leastSecure, mergeFacts, pushCheck } from '../../src/fact-record';
import type { Question } from '../../src/curriculum/types';

const card = (fact?: string): Question => ({ prompt: 'x', answer: '1', options: ['1'], fact });
const run = (...e: [string, 'correct' | 'wrong' | 'miss', number?][]) => {
  const l = createFactLog(); for (const [f, o, ms] of e) l.note(card(f), o, ms);
  return mergeFacts({}, l.entries(), '2026-10-06');
};

describe('fact record (#1122)', () => {
  it('counts a right and a missed fact', () => {
    const t = run(['7×8', 'correct', 3000], ['9×6', 'miss']);
    expect(t['7×8']).toMatchObject({ right: 1, wrong: 0, slow: 0, last: 'r', day: '2026-10-06' });
    expect(t['9×6']).toMatchObject({ right: 0, wrong: 1, last: 'w' });
  });
  it('6000 ms is not slow, 6001 is', () => {
    expect(run(['2×3', 'correct', 6000])['2×3'].slow).toBe(0);
    expect(run(['2×3', 'correct', 6001])['2×3']).toMatchObject({ slow: 1, right: 0, last: 's' });
  });
  it('is never slow when no time was measured', () => expect(run(['2×3', 'correct'])['2×3'].slow).toBe(0));
  it('ignores untagged cards and keeps 9×6 apart from 6×9', () => {
    const t = run([undefined as unknown as string, 'wrong'], ['9×6', 'wrong'], ['6×9', 'correct']);
    expect(Object.keys(t).sort()).toEqual(['6×9', '9×6']);
  });
  it('keeps the last three outcomes, newest last, and adds to an old tally', () => {
    const t = run(['2×2', 'wrong'], ['2×2', 'correct'], ['2×2', 'correct', 7000], ['2×2', 'correct']);
    expect(t['2×2'].last).toBe('rsr');
    expect(mergeFacts(t, [{ fact: '2×2', outcome: 'miss' }], '2026-10-07')['2×2']).toMatchObject({ wrong: 2, last: 'srw', day: '2026-10-07' });
  });
  it('pushCheck keeps the newest 10, newest first, with at most 25 missed', () => {
    let c: ReturnType<typeof pushCheck> = [];
    for (let i = 0; i < 12; i++) c = pushCheck(c, { date: '2026-10-06', score: i, missed: Array(30).fill('2×3') });
    expect(c).toHaveLength(10); expect(c[0].score).toBe(11); expect(c[0].missed).toHaveLength(25);
  });
});

describe('tagged generators (#1122)', () => {
  it('multiplication cards carry their fact as shown; division cards carry none', async () => {
    const { y3Tables } = await import('../../src/curriculum/year3-calc');
    const { y4Tables } = await import('../../src/curriculum/year4-tables');
    let seed = 7; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (const gen of [y3Tables, y4Tables]) for (const d of [1, 2, 3] as const) for (let i = 0; i < 80; i++) {
      const c = gen(d, rng);
      if (c.prompt.includes('÷')) expect(c.fact, c.prompt).toBeUndefined();
      else if (c.fact) { const [a, b] = c.fact.split('×').map(Number); expect(a >= 2 && b >= 2 && a <= 12 && b <= 12, c.fact).toBe(true); }
    }
  });
  it('the Tables Check deck tags its 25 cards but not the practice cards', async () => {
    const { mtcDeck, MTC_PRACTICE } = await import('../../src/game/mtc');
    const deck = mtcDeck(Math.random);
    expect(deck.slice(0, MTC_PRACTICE).every(d => !d.q.fact)).toBe(true);
    expect(deck.slice(MTC_PRACTICE).every(d => d.q.fact === d.q.prompt.replace(' = ?', '').replace(/ /g, ''))).toBe(true);
  });
});

describe('leastSecure (#1123)', () => {
  const f = (right: number, wrong: number, slow: number, last: string, day = '2026-10-06') => ({ right, wrong, slow, last, day });
  it('leaves out secure facts and facts with no tries', () => {
    expect(leastSecure({ '7×8': f(3, 0, 0, 'rrr'), '2×2': f(0, 0, 0, ''), '3×4': f(2, 0, 0, 'rr') })).toEqual([['3×4']]);
  });
  it('ranks by (wrong + slow) / tries, highest first', () => {
    const t = { '2×3': f(3, 1, 0, 'wrr'), '4×5': f(1, 3, 0, 'www'), '6×7': f(2, 1, 1, 'rsw') };
    expect(leastSecure(t).map(l => l[0])).toEqual(['4×5', '6×7', '2×3']);
  });
  it('breaks a tie by the most recent day, then by the fact text', () => {
    const t = { '3×3': f(0, 1, 0, 'w', '2026-10-05'), '4×4': f(0, 1, 0, 'w', '2026-10-06'), '2×2': f(0, 1, 0, 'w', '2026-10-06') };
    expect(leastSecure(t).map(l => l[0])).toEqual(['2×2', '4×4', '3×3']);
  });
  it('puts a fact and its reversed pair on one line, and a square fact alone', () => {
    const t = { '9×6': f(0, 2, 0, 'ww'), '6×9': f(1, 1, 0, 'rw'), '7×7': f(0, 1, 0, 'w'), '3×5': f(0, 1, 0, 'w') };
    expect(leastSecure(t)).toEqual([['3×5'], ['7×7'], ['9×6', '6×9']])   // the line sits where its first-ranked member does; 9×6 ties 3×5 and 7×7 on ratio and day, then loses on text;
  });
  it('lists a fact alone when its reversed pair is secure', () => {
    expect(leastSecure({ '9×6': f(0, 1, 0, 'w'), '6×9': f(3, 0, 0, 'rrr') })).toEqual([['9×6']]);
  });
  it('stops at 8 lines (a pair is one line)', () => {
    const t: Record<string, ReturnType<typeof f>> = {};
    for (let a = 2; a <= 10; a++) t[`${a}×${a}`] = f(0, 1, 0, 'w');
    expect(leastSecure(t)).toHaveLength(8);
    expect(leastSecure(t, 3)).toHaveLength(3);
  });
});

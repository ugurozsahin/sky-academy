import { describe, expect, it } from 'vitest';
import { createFactLog, mergeFacts, pushCheck } from '../../src/fact-record';
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

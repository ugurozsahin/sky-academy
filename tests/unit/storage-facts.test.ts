import { beforeEach, describe, expect, it } from 'vitest';
import { load, recordGameEnd, reset } from '../../src/storage';

const mem: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; }, clear: () => { for (const k in mem) delete mem[k]; } };
const game = { mode: 'mission' as const, won: true, correct: 1, attempts: 2, bestCombo: 0, stars: 2, score: 50 };
const at = new Date('2026-10-06T12:00:00');

describe('recordGameEnd merges the fact record (#1122)', () => {
  beforeEach(() => reset());
  it('writes facts and a check into ks2, and they survive a reload', () => {
    recordGameEnd({ ...game, facts: [{ fact: '7×8', outcome: 'correct', ms: 3000 }, { fact: '9×6', outcome: 'miss' }], check: { score: 24, missed: ['9×6'] } }, 0, at);
    const k = load().ks2;
    expect(k.facts['7×8']).toMatchObject({ right: 1, last: 'r', day: '2026-10-06' });
    expect(k.facts['9×6']).toMatchObject({ wrong: 1 });
    expect(k.checks).toEqual([{ date: '2026-10-06', score: 24, missed: ['9×6'] }]);
  });
  it('a game with no facts leaves ks2 alone', () => {
    recordGameEnd(game, 0, at);
    expect(load().ks2).toEqual({ facts: {}, checks: [], words: {} });
  });
});

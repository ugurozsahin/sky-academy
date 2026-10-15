import { beforeEach, describe, expect, it, vi } from 'vitest';
import { load, recordGameEnd, reset, save } from '../../src/storage';
import { lockedLines } from '../../src/ui/play-facts';

// minimal localStorage shim for node
const mem: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; }, clear: () => { for (const k in mem) delete mem[k]; } };

describe('recordGameEnd locks a secure fact in the same write (#1176)', () => {
  beforeEach(() => reset());
  const win = (ms: number) => ({ mode: 'mission' as const, won: true, correct: 1, attempts: 1, bestCombo: 1, stars: 1, score: 1, facts: [{ fact: '7×8', outcome: 'correct', ms }] });
  it('sets locked and reports the fact once; a second game reports nothing', () => {
    const d = load(); d.ks2.facts['7×8'] = { right: 2, wrong: 0, slow: 0, last: 'rr' }; save({ ks2: d.ks2 });
    const spy = vi.spyOn(localStorage, 'setItem');
    const out = recordGameEnd(win(1500), 0);
    expect(out.secured).toEqual(['7×8']);
    expect(spy).toHaveBeenCalledTimes(1);   // #365: one write
    spy.mockRestore();
    expect(load().ks2.facts['7×8']).toMatchObject({ last: 'rrr', locked: true });
    expect(recordGameEnd(win(1500), 0).secured).toEqual([]);
  });
  it('a slipped and recovered fact is not announced again', () => {
    const d = load(); d.ks2.facts['7×8'] = { right: 3, wrong: 0, slow: 0, last: 'rrr', locked: true }; save({ ks2: d.ks2 });
    recordGameEnd({ ...win(1500), facts: [{ fact: '7×8', outcome: 'wrong' }] }, 0);
    for (let i = 0; i < 3; i++) expect(recordGameEnd(win(1500), 0).secured).toEqual([]);
    expect(load().ks2.facts['7×8'].last).toBe('rrr');
  });
  it('an old save without last or locked loads unchanged', () => {
    const d = load(); d.ks2.facts['2×3'] = { right: 1, wrong: 0, slow: 0 }; save({ ks2: d.ks2 });
    expect(load().ks2.facts['2×3']).toEqual({ right: 1, wrong: 0, slow: 0 });
  });
  it('one best line, and none when nothing was secured', () => {
    expect(lockedLines(undefined)).toEqual([]);
    expect(lockedLines(['7×8'])).toEqual([{ kind: 'best', text: '7 × 8 locked in', spoken: '7 times 8 locked in' }]);
  });
});

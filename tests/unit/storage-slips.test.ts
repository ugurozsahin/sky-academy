// recordGameEnd()'s optional `slips` (#938), split out of storage.test.ts: that file is frozen at its #1387
// length and a new test goes in its own file rather than growing it (`.claude/skills/add-topic/SKILL.md`).
import { describe, it, expect, beforeEach } from 'vitest';
import { activeProfile, recordGameEnd, saveKeyFor, save, setActiveProfile, reset } from '../../src/storage';

// minimal localStorage shim for node, same as tests/unit/storage.test.ts
const mem: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; }, clear: () => { for (const k in mem) delete mem[k]; } };

// #938: recordGameEnd()'s optional `slips` — prepended ahead of whatever is already stored, stamped with
// `now`'s local day (not the caller's), and capped at 20 the same way sanitizeSlips() caps a Restore paste.
describe('recordGameEnd(): slips (#938)', () => {
  const disked = () => JSON.parse(localStorage.getItem(saveKeyFor(activeProfile()))!);
  beforeEach(() => { localStorage.removeItem('sna:profiles:tombstones'); setActiveProfile('p1'); reset(); });

  const memoryWin = { mode: 'memory' as const, won: true, correct: 12, attempts: 14, bestCombo: 0, stars: 3, score: 120 };
  const oneSlip = { topic: 'y1-add', prompt: '4 + 5', answer: '9', picked: '8' };

  it('with no slips, the stored list is untouched', () => {
    save({ slips: [{ topic: 'y1-add', prompt: '1 + 1', answer: '2', picked: '', at: '2026-01-01' }] });
    recordGameEnd(memoryWin, 0);
    expect(disked().slips).toHaveLength(1);
  });
  it('a new slip is prepended (newest first) and stamped with this call\'s own day', () => {
    save({ slips: [{ topic: 'y1-add', prompt: '1 + 1', answer: '2', picked: '', at: '2026-01-01' }] });
    recordGameEnd({ ...memoryWin, slips: [oneSlip] }, 0, new Date('2026-09-29T12:00:00Z'));
    expect(disked().slips).toEqual([{ ...oneSlip, at: '2026-09-29' }, { topic: 'y1-add', prompt: '1 + 1', answer: '2', picked: '', at: '2026-01-01' }]);
  });
  // A single session can miss more than one question — missSlips() already puts its own slips newest-first
  // (tests/unit/session-slips.test.ts pins that), so recordGameEnd() must not re-order what it is handed,
  // only prepend it.
  it('several slips from one call keep the order they arrived in, all stamped with this call\'s own day', () => {
    const newer = { topic: 'y1-add', prompt: '4 + 5', answer: '9', picked: '8' };
    const older = { topic: 'y1-sub', prompt: '9 − 3', answer: '6', picked: '5' };
    save({ slips: [{ topic: 'y1-add', prompt: '1 + 1', answer: '2', picked: '', at: '2026-01-01' }] });
    recordGameEnd({ ...memoryWin, slips: [newer, older] }, 0, new Date('2026-09-29T12:00:00Z'));
    expect(disked().slips).toEqual([
      { ...newer, at: '2026-09-29' }, { ...older, at: '2026-09-29' },
      { topic: 'y1-add', prompt: '1 + 1', answer: '2', picked: '', at: '2026-01-01' },
    ]);
  });
  it('stays capped at 20, dropping the oldest', () => {
    const old = Array.from({ length: 20 }, (_, i) => ({ topic: 'y1-add', prompt: `q${i}`, answer: '1', picked: '', at: '2026-01-01' }));
    save({ slips: old });
    recordGameEnd({ ...memoryWin, slips: [oneSlip] }, 0, new Date('2026-09-29T12:00:00Z'));
    const stored = disked().slips;
    expect(stored).toHaveLength(20);
    expect(stored[0]).toEqual({ ...oneSlip, at: '2026-09-29' });
    expect(stored.at(-1)).toEqual(old.at(-2));               // the 20th old entry (index 19) is the one dropped
  });
});

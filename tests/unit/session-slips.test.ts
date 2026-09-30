// missSlips() (#938), split out of session.test.ts: that file is frozen at its #1387 length and a new test
// goes in its own file rather than growing it (`.claude/skills/add-topic/SKILL.md`).
import { describe, it, expect } from 'vitest';
import { missSlips, type Miss } from '../../src/game/session';
import { topicById } from '../../src/curriculum';

// same mulberry32 rng as tests/unit/session.test.ts's own copy — kept identical rather than shared, per the
// project's convention for these small per-file seed helpers.
function rng(seed: number) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

describe('missSlips (#938): SessionResult.misses → the shape recordGameEnd() stores', () => {
  const topicA = topicById('y1-add')!;
  it('prefers q.listen over q.prompt, and turns a null pick into an empty string — no `at`, storage.ts stamps that', () => {
    const q = topicA.gen(1, rng(300)); const withListen = { ...q, listen: 'spoken form' };
    // `misses` itself is oldest-first/newest-last (`recordMiss`'s own doc) — `oldest` here is the earlier slip.
    const oldest: Miss = { topic: topicA.id, q: withListen, picked: 'wrong-guess' };
    const newest: Miss = { topic: topicA.id, q, picked: null };
    expect(missSlips([oldest, newest])).toEqual([
      { topic: topicA.id, prompt: q.prompt, answer: q.answer, picked: '' },                                    // newest first
      { topic: topicA.id, prompt: 'spoken form', answer: withListen.answer, picked: 'wrong-guess' },           // then oldest
    ]);
  });
  it('is empty for no misses', () => { expect(missSlips([])).toEqual([]); });
});

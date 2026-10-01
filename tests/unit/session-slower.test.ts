// "Slower bubbles" (#905), split out of session.test.ts: that file is frozen at its #1387 length and a new
// test goes in its own file rather than growing it (`.claude/skills/add-topic/SKILL.md`).
//
// `SessionOpts.slower` reaches `ModeCtx` the same way #311's own tests (in session.test.ts) prove
// `Question.slow` does: the `ctx` getter's own line is the seam, and a real `Session` is what drives it, not
// a hand-built `ModeCtx` the way every other test of the easing maths (tests/unit/modes.test.ts) does.
import { describe, it, expect, vi } from 'vitest';
import { Session } from '../../src/game/session';
import { YEARS } from '../../src/curriculum';

// same mulberry32 rng as tests/unit/session.test.ts's own copy — kept identical rather than shared, per the
// project's convention for these small per-file seed helpers.
function rng(seed: number) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const events = (): any => ({ onQuestion: vi.fn(), onCorrect: vi.fn(), onWrong: vi.fn(), onMiss: vi.fn(), onProgress: vi.fn(), onLives: vi.fn(), onStageClear: vi.fn(), onTime: vi.fn(), onBoss: vi.fn(), onEnd: vi.fn() });

describe('the "Slower bubbles" setting reaches the real session (#905)', () => {
  const Y2 = YEARS.find(y => y.id === 'year2')!;
  const plain = { id: 'test-plain', title: 'Plain', icon: '🐢', subject: 'maths' as const, year: 'year2' as const, nc: 'test',
    gen: () => ({ prompt: '45 + 27 = ?', answer: '72', options: ['72', '62', '82'] }) };

  it('Session.speed drops one step when SessionOpts.slower is set, with no question flag involved', () => {
    expect(Y2.speeds[4], 'Y2 stage 5 is the fastest step').toBe(3);
    const at = (slower: boolean) => {
      const ev = events();
      const s = new Session({ mode: 'mission', year: Y2, topic: plain, rng: rng(3), stages: 5, slower }, ev);
      s.start();
      while (s.stage < 5) { for (let i = 0; i < Y2.perStage; i++) { s.hit(s.current!.answer); s.advance(); } s.nextStage(); }
      return s.speed;
    };
    expect(at(false)).toBe(3);
    expect(at(true)).toBe(2);
  });

  it('defaults to off when SessionOpts.slower is not passed at all', () => {
    const ev = events();
    const s = new Session({ mode: 'mission', year: Y2, topic: plain, rng: rng(3), stages: 5 }, ev);
    s.start();
    while (s.stage < 5) { for (let i = 0; i < Y2.perStage; i++) { s.hit(s.current!.answer); s.advance(); } s.nextStage(); }
    expect(s.speed, 'unset means the same speed as slower: false').toBe(3);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { Session } from '../../src/game/session';
import { YEARS, topicsFor } from '../../src/curriculum';

function rng(seed: number) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const events = (): any => ({ onQuestion: vi.fn(), onCorrect: vi.fn(), onWrong: vi.fn(), onMiss: vi.fn(), onProgress: vi.fn(), onLives: vi.fn(), onStageClear: vi.fn(), onTime: vi.fn(), onBoss: vi.fn(), onEnd: vi.fn() });
const Y1 = YEARS[1];
const solve = (s: Session) => { const c = s.current!; if (!c.sequence) return s.hit(c.answer); let r: ReturnType<Session['hit']> = 'ignored'; for (const l of c.sequence) r = s.hit(l); return r; };

describe('relaxed practice session (#937)', () => {
  const pool = topicsFor('year1').filter(t => t.input !== 'tracing');
  it('costs nothing for a wrong slice or a fall, ends after ten questions, pays one coin per right answer and no stars', () => {
    const ev = events();
    const s = new Session({ mode: 'relaxed', year: Y1, pool, rng: rng(21) }, ev);
    s.start();
    expect(s.timeLeft).toBe(0);   // no clock
    for (let i = 0; i < 10; i++) {
      expect(s.ended, `still running at question ${i + 1}`).toBe(false);
      if (i < 3) { s.fall(s.current!.sequence ? s.current!.sequence[0] : s.current!.answer); expect(s.lives).toBe(Y1.lives); }
      else expect(solve(s)).not.toBe('ignored');
      s.advance();
    }
    expect(ev.onLives).not.toHaveBeenCalled();
    expect(ev.onEnd).toHaveBeenCalledTimes(1);
    const r = ev.onEnd.mock.calls[0][0];
    expect(r.mode).toBe('relaxed'); expect(r.won).toBe(true); expect(r.questions).toBe(10);
    expect(r.stars).toBe(0); expect(r.coins).toBe(r.correct); expect(r.correct).toBe(7);
  });
});

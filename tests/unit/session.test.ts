import { describe, it, expect, vi } from 'vitest';
import { Session, type SessionEvents } from '../../src/game/session';
import { YEARS, topicById, topicsFor } from '../../src/curriculum';

function rng(seed: number) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const events = (): any => ({ onQuestion: vi.fn(), onCorrect: vi.fn(), onWrong: vi.fn(), onMiss: vi.fn(), onProgress: vi.fn(), onLives: vi.fn(), onStageClear: vi.fn(), onTime: vi.fn(), onBoss: vi.fn(), onEnd: vi.fn() });
const Y1 = YEARS[1], R = YEARS[0];
/** Answer the current question correctly: a sequence (spelling / sentence) is sliced item by item. */
const solve = (s: Session) => { const c = s.current!; if (!c.sequence) return s.hit(c.answer); let r: ReturnType<Session['hit']> = 'ignored'; for (const l of c.sequence) r = s.hit(l); return r; };

describe('mission session', () => {
  it('runs all stages of perStage questions and ends won with stars and coins', () => {
    const ev = events();
    const s = new Session({ mode: 'mission', year: Y1, topic: topicById('y1-add')!, rng: rng(1) }, ev);
    s.start();
    let stageClears = 0;
    expect(s.stages).toBe(5);
    for (let stage = 1; stage <= s.stages; stage++) {
      for (let i = 0; i < Y1.perStage; i++) {
        expect(s.stage).toBe(stage);
        expect(s.hit(s.current!.answer)).toBe('correct');
        s.advance();
      }
      stageClears++;
      expect(ev.onStageClear).toHaveBeenCalledTimes(stageClears);
      expect(ev.onStageClear.mock.calls[stageClears - 1][1]).toBe(3); // perfect accuracy → 3 stars
      s.nextStage();
    }
    expect(ev.onEnd).toHaveBeenCalledTimes(1);
    const r = ev.onEnd.mock.calls[0][0];
    expect(r.won).toBe(true); expect(r.stars).toBe(3); expect(r.correct).toBe(Y1.perStage * s.stages); expect(r.score).toBeGreaterThan(0);
    expect(r.coins).toBe(Y1.perStage * s.stages + 3 * s.stages * 5 + 20);
  });
  it('Sensei training: a mission over a pool tallies hits and tries per topic', () => {
    const ev = events();
    const pool = [topicById('y1-add')!, topicById('y1-sub')!];
    const s = new Session({ mode: 'mission', year: Y1, pool, rng: rng(5) }, ev);
    s.start();
    for (let i = 0; i < Y1.perStage; i++) {
      expect(pool).toContain(s.currentTopic);
      if (i === 0) { const wrong = s.current!.options.find(o => o !== s.current!.answer)!; expect(s.hit(wrong)).toBe('wrong'); }
      else expect(solve(s)).toBe('correct');
      s.advance();
    }
    const tallies = Object.values(s.byTopic);
    expect(Object.keys(s.byTopic).every(id => pool.some(t => t.id === id))).toBe(true);
    expect(tallies.reduce((n, t) => n + t.tries, 0)).toBe(Y1.perStage);
    expect(tallies.reduce((n, t) => n + t.hits, 0)).toBe(Y1.perStage - 1);
  });
  it('wrong answers lose lives and 0 lives ends the game lost', () => {
    const ev = events();
    const s = new Session({ mode: 'mission', year: Y1, topic: topicById('y1-sub')!, rng: rng(2) }, ev);
    s.start();
    for (let i = 0; i < Y1.lives; i++) {
      const wrong = s.current!.options.find(o => o !== s.current!.answer)!;
      expect(s.hit(wrong)).toBe('wrong');
      if (s.lives > 0) s.advance();
    }
    expect(s.lives).toBe(0);
    expect(ev.onEnd.mock.calls[0][0].won).toBe(false);
  });
  it('ignores hits while waiting for the next question', () => {
    const ev = events();
    const s = new Session({ mode: 'mission', year: Y1, topic: topicById('y1-add')!, rng: rng(3) }, ev);
    s.start(); s.hit(s.current!.answer);
    expect(s.hit(s.current!.answer)).toBe('ignored');
  });
  it('reception is gentle: a missed correct bubble costs no life', () => {
    const ev = events();
    const s = new Session({ mode: 'mission', year: R, topic: topicById('r-add')!, rng: rng(4) }, ev);
    s.start(); s.fall(s.current!.answer);
    expect(ev.onMiss).toHaveBeenCalled(); expect(s.lives).toBe(R.lives);
  });
  it('year 1 missed correct bubble costs a life', () => {
    const ev = events();
    const s = new Session({ mode: 'mission', year: Y1, topic: topicById('y1-add')!, rng: rng(5) }, ev);
    s.start(); s.fall(s.current!.answer);
    expect(s.lives).toBe(Y1.lives - 1);
  });
  it('spelling sequences require letters in order and relaunch remaining letters', () => {
    const ev = events();
    const s = new Session({ mode: 'mission', year: R, topic: topicById('r-build')!, rng: rng(6) }, ev);
    s.start();
    const q = s.current!; expect(q.sequence).toBeTruthy();
    const labels = ev.onQuestion.mock.calls[0][1].labels as string[];
    for (const l of q.sequence!) expect(labels).toContain(l);
    // wrong letter first (a decoy)
    const decoy = q.options.find(o => !q.sequence!.includes(o))!;
    expect(s.hit(decoy)).toBe('wrong');
    s.advance(); // moves on to next question after a wrong
    const q2 = s.current!;
    const res = q2.sequence!.map(l => s.hit(l));
    expect(res.slice(0, -1).every(r => r === 'step')).toBe(true);
    expect(res[res.length - 1]).toBe('correct');
  });
  it('sequence wave end without a decision relaunches remaining letters', () => {
    const ev = events();
    const s = new Session({ mode: 'mission', year: R, topic: topicById('r-build')!, rng: rng(7) }, ev);
    s.start(); s.hit(s.current!.sequence![0]);
    s.waveEnd();
    expect(ev.onQuestion).toHaveBeenCalledTimes(2);
    const labels = ev.onQuestion.mock.calls[1][1].labels as string[];
    expect(labels).not.toContain(undefined);
    expect(labels.length).toBeLessThan(ev.onQuestion.mock.calls[0][1].labels.length);
  });
});

describe('endless session', () => {
  it('ramps difficulty and ends on lives 0 with a score', () => {
    const ev = events();
    const s = new Session({ mode: 'endless', year: YEARS[2], pool: topicsFor('year2').filter(t => t.input !== 'tracing'), rng: rng(8) }, ev);
    s.start();
    // answer 30 questions correctly (sequence questions are sliced letter by letter, in order)
    for (let i = 0; i < 30; i++) { const c = s.current!; if (c.sequence) c.sequence.forEach(l => s.hit(l)); else s.hit(c.answer); s.advance(); }
    expect(s.difficulty).toBe(3); expect(s.speed).toBe(3); expect(s.lives).toBe(YEARS[2].lives);
    const wrongOf = () => { const c = s.current!; const t = c.sequence ? c.sequence[s.seqIndex] : c.answer; return c.options.find(o => o !== t && !(c.sequence ?? []).includes(o)) ?? c.options.find(o => o !== t)!; };
    for (let i = 0; i < 3; i++) { expect(s.hit(wrongOf())).toBe('wrong'); if (!s.ended) s.advance(); }
    expect(ev.onEnd).toHaveBeenCalled(); expect(ev.onEnd.mock.calls[0][0].score).toBeGreaterThan(300);
  });
});

describe('sprint session (60-second time attack)', () => {
  const pool = topicsFor('year1').filter(t => t.input !== 'tracing');
  const wrongOf = (s: Session) => { const c = s.current!; const t = c.sequence ? c.sequence[s.seqIndex] : c.answer; return c.options.find(o => o !== t && !(c.sequence ?? []).includes(o)) ?? c.options.find(o => o !== t)!; };
  it('starts with the full clock and never loses lives', () => {
    const ev = events();
    const s = new Session({ mode: 'sprint', year: Y1, pool, rng: rng(10) }, ev);
    s.start();
    expect(s.timeLeft).toBe(60_000); expect(s.secondsLeft).toBe(60);
    expect(s.hit(wrongOf(s))).toBe('wrong'); expect(s.lives).toBe(Y1.lives); expect(ev.onLives).not.toHaveBeenCalled();
    s.advance(); s.fall(s.current!.sequence ? s.current!.sequence[0] : s.current!.answer);
    expect(s.lives).toBe(Y1.lives); expect(s.ended).toBe(false);
    s.advance(); s.bomb(); expect(s.lives).toBe(Y1.lives);
  });
  it('tick emits once per whole second, keeps going between questions and ends won at zero', () => {
    const ev = events();
    const s = new Session({ mode: 'sprint', year: Y1, pool, rng: rng(11), seconds: 5 }, ev);
    s.start();
    s.tick(400); expect(ev.onTime).not.toHaveBeenCalled();            // 4.6 s left still displays as 5
    s.tick(600); expect(ev.onTime).toHaveBeenLastCalledWith(4);
    s.tick(-50); s.tick(0); expect(ev.onTime).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 3; i++) { expect(solve(s)).toBe('correct'); s.advance(); }
    s.tick(10_000);
    expect(ev.onTime).toHaveBeenLastCalledWith(0); expect(s.timeLeft).toBe(0); expect(s.ended).toBe(true);
    const r = ev.onEnd.mock.calls[0][0];
    expect(r.mode).toBe('sprint'); expect(r.won).toBe(true); expect(r.correct).toBe(3); expect(r.stars).toBe(1); expect(r.coins).toBe(3 + 5);
    expect(s.hit('anything')).toBe('ignored');
    s.tick(1000); expect(ev.onEnd).toHaveBeenCalledTimes(1);          // no double end
  });
  it('scores 10 per correct plus combo bonus, ramps difficulty and awards 3 stars for 12+ correct', () => {
    const ev = events();
    const s = new Session({ mode: 'sprint', year: YEARS[2], pool: topicsFor('year2').filter(t => t.input !== 'tracing'), rng: rng(12) }, ev);
    s.start();
    expect(s.difficulty).toBe(1); expect(s.speed).toBeLessThanOrEqual(YEARS[2].speeds[1]);
    solve(s); expect(s.score).toBe(10); s.advance();
    for (let i = 0; i < 11; i++) { solve(s); s.advance(); }
    expect(s.difficulty).toBe(3); expect(s.score).toBeGreaterThan(120);   // combo bonus on top of 12 × 10
    s.tick(60_000);
    const r = ev.onEnd.mock.calls[0][0];
    expect(r.stars).toBe(3); expect(r.coins).toBe(12 + 15);
  });
  it('tick is a no-op outside sprint mode', () => {
    const ev = events();
    const s = new Session({ mode: 'mission', year: Y1, topic: topicById('y1-add')!, rng: rng(13) }, ev);
    s.start(); s.tick(99_999);
    expect(s.ended).toBe(false); expect(ev.onTime).not.toHaveBeenCalled();
  });
});

describe('boss battle', () => {
  const pool = topicsFor('year1').filter(t => t.input !== 'tracing');
  const wrongOf = (s: Session) => { const c = s.current!; const t = c.sequence ? c.sequence[s.seqIndex] : c.answer; return c.options.find(o => o !== t && !(c.sequence ?? []).includes(o)) ?? c.options.find(o => o !== t)!; };
  it('correct slices hit the boss, slips heal him (capped at max), KO ends the battle won', () => {
    const ev = events();
    const s = new Session({ mode: 'boss', year: Y1, pool, rng: rng(20) }, ev);
    s.start();
    expect(s.bossMax).toBe(8); expect(s.bossHp).toBe(8);
    expect(s.hit(wrongOf(s))).toBe('wrong'); expect(s.bossHp).toBe(8);                     // already full
    expect(ev.onBoss).toHaveBeenLastCalledWith(8, 8, 'heal'); expect(s.lives).toBe(Y1.lives - 1);
    s.advance(); solve(s); expect(s.bossHp).toBe(7); expect(ev.onBoss).toHaveBeenLastCalledWith(7, 8, 'hit');
    s.advance(); s.fall(s.current!.sequence ? s.current!.sequence[0] : s.current!.answer); expect(s.bossHp).toBe(8);
    s.advance();
    for (let i = 0; i < 8; i++) { expect(s.ended).toBe(false); if (s.bossHp <= 3) expect(s.enraged).toBe(true); expect(solve(s)).toBe('correct'); if (!s.ended) s.advance(); }
    expect(s.bossHp).toBe(0); expect(s.ended).toBe(true);
    const r = ev.onEnd.mock.calls[0][0];
    expect(r.mode).toBe('boss'); expect(r.won).toBe(true); expect(r.correct).toBe(9); expect(r.attempts).toBe(11);
    expect(r.stars).toBe(2); expect(r.coins).toBe(9 + 10 + 20);                                // 82% accuracy → 2 stars
  });
  it('speeds up when the boss is on his last 3 HP and is lost when lives run out', () => {
    const ev = events();
    const s = new Session({ mode: 'boss', year: YEARS[2], pool: topicsFor('year2').filter(t => t.input !== 'tracing'), rng: rng(21), bossHp: 4 }, ev);
    s.start();
    expect(s.enraged).toBe(false); expect(s.speed).toBeLessThanOrEqual(YEARS[2].speeds[1]);
    solve(s); s.advance();
    expect(s.enraged).toBe(true); expect(s.speed).toBeLessThanOrEqual(YEARS[2].speeds[2]); expect(s.speed).toBeGreaterThanOrEqual(YEARS[2].speeds[1]);
    for (let i = 0; i < YEARS[2].lives; i++) { expect(s.hit(wrongOf(s))).toBe('wrong'); if (!s.ended) s.advance(); }
    const r = ev.onEnd.mock.calls[0][0];
    expect(r.won).toBe(false); expect(r.stars).toBe(0); expect(r.coins).toBe(1); expect(s.bossHp).toBe(4);
  });
});

describe('rewards', () => {
  it('bomb costs a life without ending the question', () => {
    const ev = events();
    const s = new Session({ mode: 'endless', year: YEARS[2], pool: topicsFor('year2').filter(t => t.input !== 'tracing'), rng: rng(9) }, ev);
    s.start(); const before = s.current; s.bomb();
    expect(s.lives).toBe(YEARS[2].lives - 1); expect(s.current).toBe(before); expect(s.waiting).toBe(false);
  });
});

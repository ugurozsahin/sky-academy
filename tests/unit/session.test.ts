import { describe, it, expect, vi } from 'vitest';
import { Session, type SessionEvents } from '../../src/game/session';
import { YEARS, topicById, topicsFor } from '../../src/curriculum';

function rng(seed: number) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const events = (): any => ({ onQuestion: vi.fn(), onCorrect: vi.fn(), onWrong: vi.fn(), onMiss: vi.fn(), onProgress: vi.fn(), onLives: vi.fn(), onStageClear: vi.fn(), onEnd: vi.fn() });
const Y1 = YEARS[1], R = YEARS[0];

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
    const s = new Session({ mode: 'endless', year: YEARS[2], pool: topicsFor('year2').filter(t => t.mode !== 'tracing'), rng: rng(8) }, ev);
    s.start();
    for (let i = 0; i < 30; i++) { s.hit(s.current!.answer); s.advance(); }
    expect(s.difficulty).toBe(3); expect(s.speed).toBe(3);
    const wrongOf = () => { const c = s.current!; const t = c.sequence ? c.sequence[s.seqIndex] : c.answer; return c.options.find(o => o !== t && !(c.sequence ?? []).includes(o)) ?? c.options.find(o => o !== t)!; };
    for (let i = 0; i < 3; i++) { expect(s.hit(wrongOf())).toBe('wrong'); if (!s.ended) s.advance(); }
    expect(ev.onEnd).toHaveBeenCalled(); expect(ev.onEnd.mock.calls[0][0].score).toBeGreaterThan(300);
  });
});

describe('rewards', () => {
  it('bomb costs a life without ending the question', () => {
    const ev = events();
    const s = new Session({ mode: 'endless', year: YEARS[2], pool: topicsFor('year2').filter(t => t.mode !== 'tracing'), rng: rng(9) }, ev);
    s.start(); const before = s.current; s.bomb();
    expect(s.lives).toBe(YEARS[2].lives - 1); expect(s.current).toBe(before); expect(s.waiting).toBe(false);
  });
});

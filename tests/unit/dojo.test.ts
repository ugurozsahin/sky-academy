import { describe, it, expect, beforeEach } from 'vitest';
import { applyEvent, carriedStreak, dailyChallenges, freshDojo, multiplier, CHALLENGE_BONUS, SET_BONUS, type DojoEvent } from '../../src/game/dojo';
import { dojoToday, load, recordDojo, reset } from '../../src/storage';

const mem: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; }, clear: () => { for (const k in mem) delete mem[k]; } };

const ev = (p: Partial<DojoEvent> = {}): DojoEvent => ({ mode: 'mission', won: true, correct: 25, attempts: 25, bestCombo: 25, stars: 3, score: 500, ...p });
const D = '2026-09-06';

describe('daily dojo', () => {
  it('picks one challenge per group, deterministically per day, and varies across days', () => {
    const a = dailyChallenges(D), b = dailyChallenges(D);
    expect(a.map(c => c.id)).toEqual(b.map(c => c.id));
    expect(a.map(c => c.group)).toEqual(['volume', 'mode', 'focus']);
    expect(new Set(a.map(c => c.id)).size).toBe(3);
    const week = Array.from({ length: 14 }, (_, i) => dailyChallenges(`2026-09-${String(i + 1).padStart(2, '0')}`).map(c => c.id).join());
    expect(new Set(week).size).toBeGreaterThan(5);
    for (const c of a) { expect(c.goal).toBeGreaterThan(0); expect(c.title.length).toBeGreaterThan(5); }
  });
  it('progress accumulates, caps at the goal and pays each bonus exactly once', () => {
    let s = freshDojo(D);
    const volume = dailyChallenges(D)[0];                                   // "Answer N questions right"
    let out = applyEvent(s, ev({ correct: 3, won: false, stars: 0, bestCombo: 1, attempts: 6 }), D);
    expect(out.state.progress[volume.id]).toBe(3); expect(out.completed).toEqual([]); expect(out.coins).toBe(0);
    out = applyEvent(out.state, ev({ correct: 40, won: false, stars: 0, bestCombo: 1, attempts: 60 }), D);
    expect(out.state.progress[volume.id]).toBe(volume.goal);
    expect(out.completed.map(c => c.id)).toContain(volume.id); expect(out.coins).toBeGreaterThanOrEqual(CHALLENGE_BONUS);
    const again = applyEvent(out.state, ev({ correct: 40, won: false, stars: 0, bestCombo: 1, attempts: 60 }), D);
    expect(again.completed).toEqual([]); expect(again.coins).toBe(0);         // no double pay
    expect(again.state.total).toBe(out.state.total);
  });
  it('mode challenges only move for their own mode', () => {
    const memoryOnly = ev({ mode: 'memory', correct: 8, attempts: 10, bestCombo: 0, stars: 3, score: 40 });
    const sprint = ev({ mode: 'sprint', correct: 12, attempts: 14, bestCombo: 6, stars: 3, score: 130 });
    const relaxed = ev({ mode: 'relaxed', correct: 7, attempts: 10, bestCombo: 3, stars: 0, score: 70 });   // #937
    const storm = ev({ mode: 'endless', won: false, correct: 9, attempts: 12, bestCombo: 4, stars: 1, score: 90 });
    for (const [date, cs] of Array.from({ length: 30 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`).map(d => [d, dailyChallenges(d)] as const)) {
      const mode = cs[1]; const s = freshDojo(date);
      const p = (e: DojoEvent) => applyEvent(s, e, date).state.progress[mode.id] ?? 0;
      if (mode.id === 'memory1') { expect(p(memoryOnly)).toBe(1); expect(p(sprint)).toBe(0); }
      if (mode.id === 'sprint1') { expect(p(sprint)).toBe(1); expect(p(memoryOnly)).toBe(0); }
      if (mode.id === 'storm80') { expect(p(storm)).toBe(80); expect(p(sprint)).toBe(0); }
      if (mode.id === 'boss1') { expect(p(ev({ mode: 'boss', won: true }))).toBe(1); expect(p(ev({ mode: 'boss', won: false }))).toBe(0); }
      if (mode.id === 'sensei1') { expect(p(ev({ training: true }))).toBe(1); expect(p(ev())).toBe(0); }
      if (['sprint1', 'boss1', 'storm80', 'memory1', 'sensei1', 'mission2'].includes(mode.id)) expect(p(relaxed), `${mode.id} must not count a relaxed run`).toBe(0);   // #937
      if (mode.id === 'mission2') { expect(p(ev())).toBe(1); expect(p(ev({ training: true }))).toBe(0); expect(p(ev({ won: false }))).toBe(0); }
    }
  });
  it('a perfect 3-star mission with a 25-combo finishes every focus challenge except the subject ones', () => {
    for (let i = 1; i <= 30; i++) {
      const date = `2026-11-${String(i).padStart(2, '0')}`; const focus = dailyChallenges(date)[2];
      const p = applyEvent(freshDojo(date), ev({ mathsCorrect: 25, topicBest: true }), date).state.progress[focus.id];
      if (focus.id === 'writing6' || focus.id === 'fix3') expect(p).toBe(0); else expect(p).toBe(focus.goal);
    }
  });
  it('finishing all three pays the set bonus, starts a dojo streak and multiplies the next day', () => {
    const all = ev({ mode: 'mission', correct: 30, attempts: 30, bestCombo: 30, stars: 3, score: 600, mathsCorrect: 15, writingCorrect: 15 });
    // Sweep modes so the day's mode challenge is met whatever it is.
    const finishDay = (s: ReturnType<typeof freshDojo>, date: string) => {
      let coins = 0; let out = applyEvent(s, ev({ fix: true, correct: 3 }), date); coins += out.coins;   // #954: the fix challenge, if drawn, completes first
      for (const e of [all, ev({ mode: 'sprint', correct: 30, attempts: 30 }), ev({ mode: 'boss', won: true }), ev({ mode: 'endless', score: 100, won: false }), ev({ mode: 'memory' }), ev({ training: true }), ev({ mode: 'relaxed' })]) { out = applyEvent(out.state, e, date); coins += out.coins; }
      return { state: out.state, coins };
    };
    const day1 = finishDay(freshDojo('2026-09-06'), '2026-09-06');
    expect(day1.state.setDone).toBe(true); expect(day1.state.done.length).toBe(3); expect(day1.state.total).toBe(3);
    expect(day1.coins).toBe(3 * CHALLENGE_BONUS + SET_BONUS);               // ×1 on the first day
    expect(day1.state.streak).toEqual({ last: '2026-09-06', days: 1 });
    expect(carriedStreak(day1.state, '2026-09-06')).toBe(0);                // today's completion does not multiply today
    expect(carriedStreak(day1.state, '2026-09-07')).toBe(1);
    expect(carriedStreak(day1.state, '2026-09-08')).toBe(0);                // a missed day resets
    const day2 = finishDay(day1.state, '2026-09-07');
    expect(day2.state.streak).toEqual({ last: '2026-09-07', days: 2 });
    // 09-07 draws correct20 · sensei1 · fix3 (#954), which finish in three separate events, each paying its own ×1.25 floor; the last also carries the set bonus
    expect(day2.coins).toBe(2 * Math.floor(CHALLENGE_BONUS * 1.25) + Math.floor((CHALLENGE_BONUS + SET_BONUS) * 1.25));
    expect(multiplier(0)).toBe(1); expect(multiplier(2)).toBe(1.5); expect(multiplier(4)).toBe(2); expect(multiplier(9)).toBe(2);
    // A new day rolls progress over but keeps streak and lifetime total.
    const rolled = applyEvent(day2.state, ev({ correct: 1, won: false, stars: 0, bestCombo: 1, attempts: 2 }), '2026-09-08').state;
    expect(rolled.date).toBe('2026-09-08'); expect(rolled.done).toEqual([]); expect(rolled.setDone).toBe(false); expect(rolled.total).toBe(6); expect(rolled.streak.days).toBe(2);
  });
});

describe('dojo storage', () => {
  beforeEach(() => reset());
  it('old saves get an empty dojo; today() view resets progress on a new day without persisting', () => {
    mem['sna:v1'] = JSON.stringify({ v: 1, name: 'Old', coins: 5 });
    expect(load().dojo.done).toEqual([]); expect(dojoToday(new Date('2026-09-06T10:00:00Z')).date).toBe('2026-09-06');
    const out = recordDojo(ev({ correct: 4, won: false, stars: 0, bestCombo: 1, attempts: 5 }), new Date('2026-09-06T10:00:00Z'));
    expect(out.state.date).toBe('2026-09-06'); expect(load().dojo.progress[dailyChallenges('2026-09-06')[0].id]).toBe(4);
    expect(dojoToday(new Date('2026-09-07T10:00:00Z')).progress).toEqual({});   // rolled view
    expect(load().dojo.date).toBe('2026-09-06');                                  // not saved until recorded
    expect(load().coins).toBe(5);                                                 // the dojo never pays coins itself
  });
});

describe('new-mode challenges (#954)', () => {
  const days = Array.from({ length: 120 }, (_, i) => { const d = new Date(Date.UTC(2026, 9, 1 + i)); return d.toISOString().slice(0, 10); });
  const dayFor = (id: string) => days.find(d => dailyChallenges(d).some(c => c.id === id))!;
  const progress = (id: string, e: DojoEvent) => { const d = dayFor(id); return applyEvent(freshDojo(d), e, d).state.progress[id] ?? 0; };
  it('every day still offers one volume, one mode and one focus challenge, and each new id is drawn', () => {
    for (const d of days.slice(0, 60)) expect(dailyChallenges(d).map(c => c.group)).toEqual(['volume', 'mode', 'focus']);
    for (const id of ['topicbest', 'fix3', 'relaxed1']) expect(dayFor(id), id).toBeTruthy();
  });
  it('Play Relaxed practice completes on a relaxed game only', () => {
    expect(progress('relaxed1', ev({ mode: 'relaxed', stars: 0 }))).toBe(1);
    expect(progress('relaxed1', ev({ mode: 'sprint' }))).toBe(0);
  });
  it('Beat a topic best completes on a Mission flagged topicBest, never a first-ever play', () => {
    expect(progress('topicbest', ev({ topicBest: true }))).toBe(1);
    expect(progress('topicbest', ev())).toBe(0);
  });
  it('Fix 3 mistakes adds the questions put right from a fix event', () => {
    const fix = ev({ fix: true, won: false, correct: 2, attempts: 3, bestCombo: 0, stars: 0, score: 0 });
    expect(progress('fix3', fix)).toBe(2);
    expect(progress('fix3', ev({ correct: 3 }))).toBe(0);
  });
  it('a fix event advances no other challenge in the pool', () => {
    const fix = ev({ fix: true, won: true, correct: 5, attempts: 5, mathsCorrect: 5, writingCorrect: 5, topicBest: true });
    for (const d of days) {
      const out = applyEvent(freshDojo(d), fix, d);
      for (const c of dailyChallenges(d)) if (c.id !== 'fix3') expect(out.state.progress[c.id], `${c.id} on ${d}`).toBe(0);
    }
  });
});

describe('a fix round pays through the dojo only (#954)', () => {
  it('records the right answers for "Fix 3 mistakes" and pays no game coins', async () => {
    const { fixRoundPayout } = await import('../../src/ui/play-results');
    reset(); const before = load().coins;
    const p = fixRoundPayout({ correct: 2, attempts: 3 });
    expect(p.dojo).not.toBeNull(); expect(p.dojoSaved).toBe(true); expect(p.streak).toBe(0); expect(p.cert).toBeNull();
    expect(load().coins - before).toBe(p.dojo!.coins);                       // only a completed challenge's bonus, never the round's own coins
    for (const c of dailyChallenges(dojoToday().date)) if (c.id !== 'fix3') expect(dojoToday().progress[c.id] ?? 0).toBe(0);
  });
  it('keeps nothing for a guest, and moves nothing for an incomplete round', async () => {
    const { fixRoundPayout, PRACTICE_PAYOUT } = await import('../../src/ui/play-results');
    reset();
    expect(fixRoundPayout({ correct: 2, attempts: 3, incomplete: true })).toBe(PRACTICE_PAYOUT);   // #522
    expect(dojoToday().progress.fix3 ?? 0).toBe(0);
    const { startGuest, endGuest } = await import('../../src/storage');
    startGuest('year1', 'ninja');
    expect(fixRoundPayout({ correct: 2, attempts: 3 }).dojoSaved).toBe(false);   // #518
    endGuest();
  });
});

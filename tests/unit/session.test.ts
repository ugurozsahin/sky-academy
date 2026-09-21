import { describe, it, expect, vi } from 'vitest';
import { Session, starsForAccuracy, type SessionEvents } from '../../src/game/session';
import { TOPICS, YEARS, topicById, topicsFor } from '../../src/curriculum';

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

/*
 * #311 item 1 — the one line that carries `Question.slow` into the running game.
 *
 * `session.ts`'s `ctx` getter builds `slow: !!this.current?.slow`. Replace that with `slow: false` and the
 * feature is dead for every child, yet the whole suite stayed green: every other test of the flag calls
 * `MODES.*.speed()` with a hand-built `ModeCtx` and so never crosses this seam. These drive a real `Session`
 * over a generator that flags its questions, and read the speed the arena is actually told to use.
 */
describe('a flagged question slows the real session (#311, #297)', () => {
  const Y2 = YEARS.find(y => y.id === 'year2')!;
  /** A topic whose every question carries `slow`, so the pin is about the wiring rather than about which
   *  generator happens to flag a draw today. */
  const flagged = (slow: boolean) => ({
    id: 'test-slow', title: 'Slow', icon: '🐢', subject: 'maths' as const, year: 'year2' as const, nc: 'test',
    gen: () => ({ prompt: '45 + 27 = ?', answer: '72', options: ['72', '62', '82'], slow }),
  });

  it('Session.speed and the onQuestion payload both drop a step for a flagged question', () => {
    expect(Y2.speeds[4], 'Y2 stage 5 is the fastest step — the premise of #297').toBe(3);
    const at = (slow: boolean) => {
      const ev = events();
      const s = new Session({ mode: 'mission', year: Y2, topic: flagged(slow), rng: rng(3), stages: 5 }, ev);
      s.start();
      // straight to the last, fastest stage
      while (s.stage < 5) { for (let i = 0; i < Y2.perStage; i++) { s.hit(s.current!.answer); s.advance(); } s.nextStage(); }
      ev.onQuestion.mockClear();
      s.advance();
      return { speed: s.speed, reported: ev.onQuestion.mock.calls[0][1].speed as number };
    };
    expect(at(false), 'unflagged: the stage speed as the year defines it').toEqual({ speed: 3, reported: 3 });
    expect(at(true), 'flagged: one step slower, and the arena is told so').toEqual({ speed: 2, reported: 2 });
  });
});

/**
 * #390 — the sequence of cards must not answer itself.
 *
 * `nextQuestion()` re-rolls while the new card matches the previous one, to avoid an immediate repeat. On a
 * topic whose prompt is a **constant** and whose answer space is **binary**, the `(prompt, answer)` identity
 * it used took exactly two values, so a freshly generated, genuinely different picture was rejected purely
 * for repeating the previous answer — up to five times. With a fair coin and five re-rolls consecutive cards
 * then share an answer 1.56% of the time, so "slice the other bubble" beats reading the card.
 *
 * `tests/unit/curriculum.test.ts` calls `topic.gen()` directly and so cannot see this: the defect lives in
 * the *sequence* a child plays, which only a real `Session` produces. This rail drives one.
 *
 * The topics are **discovered, not listed**, so a fifth constant-prompt binary topic is covered the day it
 * ships rather than the day somebody remembers this rail exists.
 */
describe('the previous answer carries no signal about the next (#390)', () => {
  const yearOf = (t: { year: string }) => YEARS.find(y => y.id === t.year)!;
  /** Mission stage 1 is difficulty 1 for every year (`YEARS[*].diffs[0]`), which is what the rail samples. */
  const D1 = 1 as const;

  /** Topics whose d1 cards all share one prompt and offer exactly two bubbles — where the identity degenerates. */
  const constantPromptBinary = () => TOPICS.filter(t => {
    if (t.input === 'tracing') return false;
    const r = rng(11);
    const cards = Array.from({ length: 200 }, () => t.gen(D1, r));
    return cards.every(c => c.prompt === cards[0].prompt && c.options.length === 2 && !c.sequence);
  });

  it('YEARS stage 1 is difficulty 1, which is what this rail samples', () => {
    for (const y of YEARS) expect(y.diffs[0], `${y.id} stage 1`).toBe(D1);
  });

  it('finds the four topics #390 measured, so the discovery itself cannot go blind', () => {
    const found = constantPromptBinary().map(t => t.id).sort();
    // `it.each([])` registers nothing in Vitest 3 rather than erroring, so a discovery that went blind would
    // report the band rail below as green with no cases at all. This line makes the floor deliberate
    // (PR #407 review, note 3).
    expect(found.length, 'the discovery found nothing — the band rail below would silently run no cases').toBeGreaterThanOrEqual(4);
    for (const id of ['r-oddeven', 'y2-sentencetype', 'y2-symmetry', 'y2-tense']) expect(found).toContain(id);
  });

  it.each(constantPromptBinary().map(t => t.id))('%s: consecutive answers agree about half the time', (id) => {
    const topic = topicById(id)!;
    const s = new Session({ mode: 'mission', year: yearOf(topic), topic, rng: rng(7) }, events());
    s.start();
    let prev = s.current!, same = 0;
    const pairs = 600;
    for (let i = 0; i < pairs; i++) {
      s.nextQuestion();
      const q = s.current!;
      expect(q.prompt, 'the premise: one constant prompt').toBe(prev.prompt);
      expect(q.options.length, 'the premise: a binary answer space').toBe(2);
      if (q.answer === prev.answer) same++;
      prev = q;
    }
    // What this band bounds is "the previous answer is no help", not "exactly a fair coin" (PR #407 review,
    // note 4): a correct implementation still refuses an *identical* card, so its expected agreement is
    // (0.5 − P(identical)) / (1 − P(identical)), which drifts below 0.5 as a topic's d1 pool shrinks —
    // `y2-sentencetype` already sits near 0.45. The floor is set well under that drift, and the ceiling
    // exists only to catch a key that went the other way. The broken dedupe read ~0.016, nowhere near either.
    expect(same / pairs).toBeGreaterThan(0.35);
    expect(same / pairs).toBeLessThan(0.65);
  });

  /**
   * The other half of the same key — and it must run on topics that **have a visual**, or it cannot see the
   * term this key added at all (PR #407 review, B2). The first cut asserted this on `y2-oddeven` alone,
   * which carries no visual, so `repeatKey` reduced there byte-for-byte to the old `prompt \0 answer` and
   * the test behaved identically before and after the widening.
   *
   * What it caught nothing of: stringifying the whole visual put a per-draw emoji into the card's identity,
   * so `1 + 4 = ?` came round twice running 11.75% of the time on `r-add`, against 0.00% on `main`.
   *
   * So the topics are discovered here too: every d1 topic whose prompt is **self-contained** — more than one
   * prompt, and each prompt always has the same answer — because on those the prompt IS the exercise, and an
   * identical prompt with an identical answer twice running is the same card however it is decorated. 47
   * topics qualify, 33 of them with a visual.
   */
  const selfContainedPrompt = () => TOPICS.filter(t => {
    if (t.input === 'tracing') return false;
    const r = rng(11);
    const cards = Array.from({ length: 300 }, () => t.gen(D1, r));
    if (cards.some(c => c.sequence)) return false;
    const byPrompt = new Map<string, Set<string>>();
    for (const c of cards) (byPrompt.get(c.prompt) ?? byPrompt.set(c.prompt, new Set()).get(c.prompt)!).add(c.answer);
    return byPrompt.size > 1 && [...byPrompt.values()].every(a => a.size === 1);
  });

  it('the self-contained-prompt discovery finds the topics it is meant to', () => {
    const found = selfContainedPrompt().map(t => t.id);
    expect(found.length, 'nothing discovered — the rail below would run no cases').toBeGreaterThanOrEqual(20);
    // Four with a visual and one without, so a change that quietly narrowed this to prompt-only topics —
    // which is exactly how B2 went blind — fails here.
    for (const id of ['r-add', 'r-sub', 'r-share', 'r-balance', 'y2-oddeven']) expect(found).toContain(id);
  });

  it.each(selfContainedPrompt().map(t => t.id))('%s: the same exercise is never asked twice running', (id) => {
    const topic = topicById(id)!;
    const s = new Session({ mode: 'mission', year: yearOf(topic), topic, rng: rng(7) }, events());
    s.start();
    let prev = s.current!, repeats = 0;
    const pairs = 600;
    for (let i = 0; i < pairs; i++) {
      s.nextQuestion();
      const q = s.current!;
      if (q.prompt === prev.prompt && q.answer === prev.answer) repeats++;
      prev = q;
    }
    // 46 of the 47 measure 0. `r-share` measures 3: its d1 pool is three prompts, so the five re-rolls give
    // up at (1/3)^6 ≈ 0.14% — the same 3 it measures on `main`, not a cost of this key. The bound sits an
    // order of magnitude above that and an order below B1's 7.75%–30.8%, so neither the seed nor a small
    // pool decides the verdict.
    expect(repeats / pairs, 'the same question asked twice running').toBeLessThan(0.02);
  });
});

describe('starsForAccuracy — the one three-star bar (#397 review round 2, B2)', () => {
  // The thresholds used to be written out here AND copied into `duelStars`, with a comment claiming that moving
  // one would go red. It would not: the duel test asserted the copy, so both stayed green and the two scales
  // could drift apart in silence. There is one function now, and this table is the only thing pinning it — the
  // duel test asserts the same numbers *through* `duelStars`, which now calls this.
  it('is inclusive at both boundaries', () => {
    expect(starsForAccuracy(1)).toBe(3);
    expect(starsForAccuracy(0.95)).toBe(3);      // exactly 95% — inclusive
    expect(starsForAccuracy(0.9499)).toBe(2);
    expect(starsForAccuracy(0.7)).toBe(2);       // exactly 70% — inclusive
    expect(starsForAccuracy(0.6999)).toBe(1);
    expect(starsForAccuracy(0)).toBe(1);         // never zero stars: one is the floor
  });
  it('is what a mission stage actually awards, not a second copy of it', () => {
    // Drives a real stage and checks the stage star is this function applied to the stage accuracy. If
    // `Session` ever stops calling it, this goes red — the guarantee the old comment claimed and did not have.
    const ev = events();
    const s = new Session({ mode: 'mission', year: Y1, topic: topicById('y1-add')!, rng: rng(7) }, ev);
    s.start();
    for (let i = 0; i < Y1.perStage; i++) {
      const q = s.current!;
      // One wrong answer in the stage, the rest right: accuracy lands under 95%, so the star is not 3 and the
      // assertion below is about the bar rather than about a constant.
      if (i === 0) s.hit(q.options.find(o => o !== q.answer)!); else s.hit(q.answer);
      s.advance();
    }
    expect(ev.onStageClear).toHaveBeenCalledTimes(1);
    const [, stars, acc] = ev.onStageClear.mock.calls[0];
    expect(stars, 'the stage star is the shared bar applied to the stage accuracy').toBe(starsForAccuracy(acc));
    expect(acc).toBeLessThan(0.95);
    expect(stars).toBeLessThan(3);
  });
});

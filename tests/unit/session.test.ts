import { describe, it, expect, vi } from 'vitest';
import { Session, repeatKey, starsForAccuracy, type SessionEvents } from '../../src/game/session';
import { TOPICS, YEARS, topicById, topicsFor, type Question } from '../../src/curriculum';

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
 * The topics are **discovered, not listed** — but read the filter for what it is, not for what it sounds
 * like (#412): it selects a *literally* constant prompt, which is a narrower thing than the class this
 * defect belongs to. `y1-mass` has two prompts ("Which is heavier?" / "Which is lighter?"), binary bubbles
 * and a ten-value key space — the target profile in every respect except the one the filter tests — and it
 * was missed here for exactly that reason. So this describe measures **these topics**, statistically; the
 * class-wide property is the exact one in `the repeat key holds the whole question (#412)` below, which
 * covers every topic with no guess at which ones degenerate.
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

/**
 * #412 — the key must hold the question **wherever the question lives**.
 *
 * #390 widened the identity from `(prompt, answer)` to include the visual, which fixed the four topics whose
 * question is carried by a picture. On nine others the question is text that is not the prompt, and there is
 * no visual at all: `measureCompare` puts the values only in `hint` and `say`, and `soundQ`'s prompt is the
 * constant `🔊 Listen!` with its three keyword words in `listen` and `say`. So the key still reduced to the
 * answer, and the re-roll loop refused every card whose answer matched the previous one — `r-soundhunt`
 * repeated the target sound **0.000%** of the time over 4000 in-session pairs, against a generator rate of
 * 6.1%. A child who remembered the last answer was doing better than one who listened.
 *
 * Two rails, one exact and one behavioural, and the first is the important one because it needs no statistics
 * and no list of suspect topics:
 *
 * 1. **No two cards that ask different things share a key.** `asked()` below is written here, from the
 *    `Question` fields a child reads or hears, and is deliberately *not* read off `repeatKey` — it is the
 *    requirement, and the key is the thing under test. Every playable topic, every difficulty. Before this
 *    fix it failed on all nine: `y1-mass` collapsed 1,976 different cards onto 10 keys.
 * 2. **The previous answer carries no signal**, measured against the generator's own rate rather than against
 *    a guess at what a fair rate would be. That comparison is what makes it apply to topics whose answer is a
 *    colour or a grapheme, where "about half the time" is simply wrong: `y1-mass` draws two of eight colours
 *    per card, so ~0.2 is its natural rate, and 0.11 is not evidence of anything. Restricted to topics with
 *    at least ten distinct cards per answer, because only there is refusing an *identical* card too small an
 *    effect to explain a gap — that refusal is correct behaviour, and on a three-card topic like `r-share` it
 *    legitimately drives agreement to zero.
 *
 * Rails 1 and 3 are the two halves of one claim — **the key's partition of the cards is exactly the
 * question's** — and the second half exists because the first half alone let a real regression through
 * (review round 1, B1/B2). Keying `listen` raw made the same sound-hunt card look like a different one, six
 * ways per question, and every rail on this file stayed green: `the same exercise is never asked twice
 * running` above runs 47 cases, and none of the twelve topics whose key these content fields changed is among
 * them — it selects for a literally constant prompt with one answer per prompt, which rejects the order
 * topics (they carry a `sequence`), the sound-hunt topics (one prompt) and the measurement topics (five
 * answers to "Which is lighter?"). So the too-discriminating direction is asserted here, on the fields this
 * key actually reads, rather than delegated to a rail that cannot see them.
 *
 * No rail here names a topic, so the tenth one is covered the day it ships.
 */
describe('the repeat key holds the whole question (#412)', () => {
  const D1 = 1 as const;
  const yearOf = (t: { year: string }) => YEARS.find(y => y.id === t.year)!;
  /**
   * Everything the card asks: what a child reads on it, hears from it, and must slice. No decoration — and
   * a `' · '` list is a **set**, because three generators build one from a per-draw shuffle (B1). This is
   * written from the `Question` contract on purpose, rather than read off `repeatKey`: it is the requirement,
   * and the key is the thing under test.
   */
  const asked = (q: Question) => {
    const set = (s: string) => (s.includes(' · ') ? s.split(' · ').sort().join(' · ') : s);
    return [q.prompt, q.answer, set(q.hint ?? ''), set(q.listen ?? ''), (q.sequence ?? []).join('\u0001')].join('\u0000');
  };
  const playable = TOPICS.filter(t => t.input !== 'tracing');

  it('there are topics to measure at all', () => {
    expect(playable.length, 'nothing discovered — every case below would run on an empty set').toBeGreaterThan(50);
  });

  it.each(playable.map(t => t.id))('%s: two cards that ask different things never share one key', (id) => {
    const topic = topicById(id)!;
    for (const d of [1, 2, 3] as const) {
      const r = rng(11);
      const byKey = new Map<string, string>();
      for (let i = 0; i < 700; i++) {
        const q = topic.gen(d, r);
        const k = repeatKey(q), a = asked(q);
        const seen = byKey.get(k);
        if (seen === undefined) byKey.set(k, a);
        // The message carries the two cards, because "10 keys for 1,976 cards" says nothing about which field
        // went missing from the key and the two prompts side by side say it at a glance.
        else expect(seen, `d${d}: one key for two different questions — ${JSON.stringify(seen)} and ${JSON.stringify(a)}`).toBe(a);
      }
    }
  });

  /**
   * The converse, and the half whose absence let B1 ship: **one question must never take two keys.** Without
   * it a key can pass the rail above by being ever finer, which is how `listen`'s per-draw word order got in.
   *
   * Cards are grouped by what they ask *with the visual held identical*, so a per-draw sticker — the `emoji`
   * that PR #407's B1 was about — can never force a false red here. That makes it full strength exactly where
   * B1 lived: neither sound-hunt topic nor any measurement topic carries a visual at all.
   */
  it.each(playable.map(t => t.id))('%s: two cards that ask the same thing never take two keys', (id) => {
    const topic = topicById(id)!;
    for (const d of [1, 2, 3] as const) {
      const r = rng(11);
      const byAsked = new Map<string, { key: string; q: Question }>();
      for (let i = 0; i < 700; i++) {
        const q = topic.gen(d, r);
        const g = `${asked(q)}\u0002${JSON.stringify(q.visual ?? null)}`;
        const k = repeatKey(q), seen = byAsked.get(g);
        if (seen === undefined) byAsked.set(g, { key: k, q });
        else expect(seen.key, `d${d}: two keys for one question — ${JSON.stringify(seen.q)} and ${JSON.stringify(q)}`).toBe(k);
      }
    }
  });

  /**
   * And the fields the key must **ignore**, asserted directly rather than argued in a docstring. `say` is the
   * one judgement `session.ts` defends at length and nothing held it: folding `q.say` in is 176/176 green and
   * switches de-duplication off on `r-order`, whose `say` speaks the numbers in their shuffled display order
   * (review round 1, note 1). `options` is re-shuffled every draw, and `wide`/`peek`/`slow` are how a card is
   * presented, not what it asks.
   */
  it('the key ignores every field that carries presentation rather than content', () => {
    for (const t of playable) {
      const q = t.gen(D1, rng(3));
      const base = repeatKey(q);
      const presentation: Partial<Question>[] = [
        { say: 'spoken some other way entirely' },
        { options: [...q.options].reverse() },
        { wide: !q.wide }, { peek: !q.peek }, { slow: !q.slow },
      ];
      for (const field of presentation) {
        const name = Object.keys(field)[0];
        expect(repeatKey({ ...q, ...field }), `${t.id}: \`${name}\` reached the card's identity`).toBe(base);
      }
    }
  });

  /**
   * Per topic at d1: the generator's own consecutive-agreement rate, the rate a driven `Session` produces, and
   * how many distinct cards there are per distinct answer. Computed once — three of these numbers are wanted
   * by the discovery and by the assertion, and a second pass would double the cost of the file.
   */
  const PAIRS = 1500;
  const stats = playable.map(t => {
    const r = rng(11);
    const cards = Array.from({ length: PAIRS + 1 }, () => t.gen(D1, r));
    let base = 0;
    for (let i = 1; i < cards.length; i++) if (cards[i].answer === cards[i - 1].answer) base++;
    const s = new Session({ mode: 'mission', year: yearOf(t), topic: t, rng: rng(7) }, events());
    s.start();
    let prev = s.current!, same = 0, sameCard = 0;
    for (let i = 0; i < PAIRS; i++) {
      s.nextQuestion();
      if (s.current!.answer === prev.answer) same++;
      if (asked(s.current!) === asked(prev)) sameCard++;
      prev = s.current!;
    }
    const contents = new Set(cards.map(asked)).size;
    return {
      id: t.id,
      baseline: base / PAIRS,
      inSession: same / PAIRS,
      repeated: sameCard / PAIRS,
      contents,
      perAnswer: contents / new Set(cards.map(c => c.answer)).size,
    };
  });
  /**
   * Where a suppressed answer cannot be explained by the refusal of an identical card, and is measurable.
   *
   * The floor is arithmetic, not a round number. Refusing an identical card removes one of a topic's
   * `perAnswer` cards from the agreement mass, so a correct implementation still measures about
   * `(1 − 1/perAnswer) × baseline`; for the 0.5 floor below to be safe, `perAnswer` must be over 2, and four
   * leaves a factor of 0.75 against it. Beneath that the suppression is legitimate and total: `r-share` maps
   * one prompt to one answer, so refusing the identical card refuses the answer and agreement is 0 by design.
   * It was `>= 10` in round 1 — a guess that happened to hold only while `asked()` counted `listen`'s word
   * order as content, which put the sound-hunt topics at 24 cards per answer instead of their real 4 (B1).
   */
  const measurable = stats.filter(s => s.perAnswer >= 4 && s.baseline * PAIRS >= 30);

  it('the measurable set holds the topics this defect was found on', () => {
    const ids = measurable.map(s => s.id);
    expect(ids.length, 'nothing discovered — the rail below would run no cases').toBeGreaterThanOrEqual(10);
    // The two extremes of the issue's own table: the listening topics, where the key *was* the answer, and a
    // measurement topic, where the values live in `hint`. If either drops out of this set, the set is wrong.
    for (const id of ['r-soundhunt', 'y1-soundhunt', 'y1-mass', 'y2-temp']) expect(ids).toContain(id);
  });

  it.each(measurable.map(s => s.id))('%s: a driven session repeats an answer about as often as the generator does', (id) => {
    const s = measurable.find(x => x.id === id)!;
    // Half the generator's rate, not a fixed number: the point is that the sequence adds no signal of its own.
    // The measured gap before the fix was total — 0.000 against 0.061 on both sound-hunt topics — and after it
    // every topic in this set sits within a few percent of its baseline, so the floor is nowhere near either.
    expect(s.inSession, `in-session ${s.inSession.toFixed(3)} against the generator's ${s.baseline.toFixed(3)}`)
      .toBeGreaterThan(s.baseline * 0.5);
  });

  /**
   * And the symptom B1 actually produced, end to end through a `Session` rather than over the key: the same
   * question served back to back. It read 1.11% on `r-soundhunt` with `listen` keyed raw and 0.000% both before
   * the change and after the fix.
   *
   * Topics with at least fifty distinct cards only, because `nextQuestion` gives up after five re-rolls and
   * serves what it has — correct behaviour, but on a three-card topic like `r-share` it makes a byte-identical
   * card about 1 transition in 700 (review round 1, note 2, pre-existing). Above fifty cards a give-up cannot
   * account for anything at this scale, so the floor is a thousandth rather than a tolerance.
   */
  const bigEnough = stats.filter(s => s.contents >= 50);
  it('the big-topic set is not empty, and holds the topics B1 was measured on', () => {
    const ids = bigEnough.map(s => s.id);
    expect(ids.length, 'nothing discovered — the rail below would run no cases').toBeGreaterThanOrEqual(20);
    for (const id of ['r-soundhunt', 'y1-soundhunt']) expect(ids).toContain(id);
  });

  it.each(bigEnough.map(s => s.id))('%s: a driven session never serves the same question twice running', (id) => {
    const s = bigEnough.find(x => x.id === id)!;
    expect(s.repeated, `served the same question back to back ${(100 * s.repeated).toFixed(3)}% of the time over ${s.contents} distinct cards`)
      .toBeLessThan(0.001);
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

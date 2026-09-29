import { describe, it, expect, vi } from 'vitest';
import { Session, repeatKey, starsForAccuracy, type DeckItem, type SessionEvents } from '../../src/game/session';
import { TOPICS, YEARS, topicById, topicsFor, type Question, type Topic } from '../../src/curriculum';

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
  /**
   * #484 (review round 1, B1): `advance()` — which is what fires `onStageClear`, and thus what lets the "Next"
   * click reach `nextStage()`/`end()` — is only ever called by the UI, never by `hit()`/`waveEnd()` itself. So
   * the very last question of the very last stage must decide the whole mission from inside the synchronous
   * `hit()` call that answers it, via `onCommit` — well before `advance()` (and the UI's own deferred timer to
   * reach it) ever runs. This is the exact scenario the review reproduced: driven to the last question, only
   * `hit()` called — `advance()`/`nextStage()`/`end()` deliberately never invoked — proving the payout does not
   * wait on either of them.
   */
  it("onCommit fires the instant the mission's last question is answered, before advance() or nextStage() ever run", () => {
    const ev = events(); ev.onCommit = vi.fn();
    const s = new Session({ mode: 'mission', year: Y1, topic: topicById('y1-add')!, rng: rng(1), stages: 1 }, ev);
    s.start();
    for (let i = 0; i < Y1.perStage - 1; i++) { expect(s.hit(s.current!.answer)).toBe('correct'); s.advance(); }
    expect(ev.onCommit).not.toHaveBeenCalled();
    expect(s.hit(s.current!.answer)).toBe('correct');           // the last question of the only stage
    expect(ev.onCommit, 'onCommit fired inside hit() itself, with no advance()/nextStage() call anywhere above').toHaveBeenCalledTimes(1);
    expect(ev.onStageClear).not.toHaveBeenCalled();
    expect(ev.onEnd).not.toHaveBeenCalled();
    expect(s.ended, "a preview must not end the session — that is still advance()/nextStage()'s job").toBe(false);
    const preview = ev.onCommit.mock.calls[0][0];
    expect(preview).toMatchObject({ won: true, stars: 3, correct: Y1.perStage, coins: Y1.perStage + 3 * 5 + 20 });
    // The natural path still runs exactly as before, and produces an EQUAL result from onEnd — proving this
    // is a preview that gets reused, never a second, possibly-different payout (which would double-pay or
    // pay a different amount than what was already committed).
    s.advance();
    expect(ev.onStageClear).toHaveBeenCalledTimes(1);
    s.nextStage();
    expect(ev.onEnd).toHaveBeenCalledTimes(1);
    expect(ev.onEnd.mock.calls[0][0]).toEqual(preview);
  });
  /**
   * The loss counterpart: a wrong answer on the last question that ALSO empties the last life is a LOST
   * mission, not a stage clear — `onCommit` must never fire `won: true` for it. `loseLife()`'s own `end(false)`
   * settles this first; `maybeCommitFinalStage()`'s `!this.ended` guard is what stops it firing at all.
   */
  it('onCommit never fires when the last question is wrong and also costs the last life', () => {
    const ev = events(); ev.onCommit = vi.fn();
    const s = new Session({ mode: 'mission', year: Y1, topic: topicById('y1-add')!, rng: rng(1), stages: 1 }, ev);
    s.start();
    expect(Y1.lives).toBeLessThan(Y1.perStage);   // room to spend every life but one before the last question
    for (let i = 0; i < Y1.lives - 1; i++) { expect(s.hit('not-the-answer')).toBe('wrong'); s.advance(); }
    for (let i = Y1.lives - 1; i < Y1.perStage - 1; i++) { expect(s.hit(s.current!.answer)).toBe('correct'); s.advance(); }
    expect(s.lives).toBe(1); expect(s.ended).toBe(false); expect(s.index).toBe(Y1.perStage - 1);
    expect(s.hit('still-not-the-answer')).toBe('wrong');   // the last question, and the last life together
    expect(s.ended, 'the mission is lost, not cleared').toBe(true);
    expect(ev.onCommit, 'a loss is never previewed as a won stage clear').not.toHaveBeenCalled();
    expect(ev.onEnd).toHaveBeenCalledTimes(1);
    expect(ev.onEnd.mock.calls[0][0].won).toBe(false);
  });
  /**
   * #522: a generator throw ends the session through the exact same `won: false` path as a genuine no-lives
   * loss (`console.error` + `end(false)`), which left `SessionResult` with no way to tell "a technical failure
   * cut this short" apart from "the child ran out of lives" — the UI showed the identical defeat screen for
   * both. `incomplete: true` is the one field that distinguishes them, mirroring `Duel`'s own `incomplete` for
   * the same #444-shaped failure.
   */
  it('a generator that throws mid-mission ends the session as incomplete, not as a genuine loss (#522)', () => {
    const ev = events();
    let calls = 0;
    const good = topicById('y1-add')!;
    // A unique `hint` per call (review, pr-test-analyzer) keeps `nextQuestion()`'s own "avoid immediate
    // repeat" retry loop from ever firing here — without it, a real `y1-add` draw that happened to repeat
    // would burn an extra `gen()` call on the retry and make the throw land one `nextQuestion()` early,
    // failing this test somewhere that doesn't point at the retry loop at all.
    const flaky = { ...good, gen: (d: Parameters<typeof good.gen>[0], r: Parameters<typeof good.gen>[1]) => { calls++; if (calls > 2) throw new Error('boom'); return { ...good.gen(d, r), hint: `call-${calls}`, hintIsData: false }; } };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const s = new Session({ mode: 'mission', year: Y1, topic: flaky, rng: rng(1) }, ev);
    s.start();
    expect(s.hit(s.current!.answer)).toBe('correct'); s.advance();
    expect(s.hit(s.current!.answer)).toBe('correct'); s.advance();   // the third nextQuestion() is what throws
    expect(s.ended).toBe(true);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('y1-add'), expect.any(Error));
    expect(ev.onEnd).toHaveBeenCalledTimes(1);
    // won: false, exactly like a genuine loss — incomplete is the only field that tells them apart, and it
    // must never be set on a real loss (the earlier "onCommit never fires..." test's own onEnd result, which
    // this mirrors, carries no `incomplete` key at all).
    expect(ev.onEnd.mock.calls[0][0]).toMatchObject({ won: false, correct: 2, attempts: 2, incomplete: true });
    spy.mockRestore();
  });
  it('a genuine loss never carries incomplete', () => {
    const ev = events();
    const s = new Session({ mode: 'mission', year: Y1, topic: topicById('y1-add')!, rng: rng(1), stages: 1 }, ev);
    s.start();
    for (let i = 0; i < Y1.lives; i++) { s.hit('not-the-answer'); s.advance(); }   // spend every life
    expect(s.ended).toBe(true);
    expect(ev.onEnd.mock.calls[0][0]).toMatchObject({ won: false, incomplete: false });
  });
  /**
   * The same preview, from the other two places `maybeCommitFinalStage()` is called (review round 2 follow-up:
   * `hit()`'s correct/wrong paths above are not the only way a mission's last question gets decided) — the
   * target bubble falling uncaught (`fall()`), and a wave that runs out with nothing hit at all
   * (`waveEnd()`'s own "nothing decided" branch). Reception is gentle, so neither costs a life, which is what
   * lets the stage still clear (on a lower accuracy) rather than ending the mission as a loss.
   */
  it("onCommit fires from fall() too, when the mission's last question is missed rather than answered", () => {
    const ev = events(); ev.onCommit = vi.fn();
    const s = new Session({ mode: 'mission', year: R, topic: topicById('r-add')!, rng: rng(1), stages: 1 }, ev);
    s.start();
    for (let i = 0; i < R.perStage - 1; i++) { expect(s.hit(s.current!.answer)).toBe('correct'); s.advance(); }
    s.fall(s.current!.answer);                                    // the last question's correct bubble, uncaught
    expect(ev.onCommit, 'onCommit fired inside fall() itself').toHaveBeenCalledTimes(1);
    expect(s.ended).toBe(false); expect(s.lives).toBe(R.lives);    // gentle: the miss costs no life
    const preview = ev.onCommit.mock.calls[0][0];
    expect(preview.won).toBe(true);
    s.advance(); s.nextStage();
    expect(ev.onEnd.mock.calls[0][0]).toEqual(preview);
  });
  it("onCommit fires from waveEnd()'s own miss branch too, when the last question's wave ends with nothing decided", () => {
    const ev = events(); ev.onCommit = vi.fn();
    const s = new Session({ mode: 'mission', year: R, topic: topicById('r-add')!, rng: rng(1), stages: 1 }, ev);
    s.start();
    for (let i = 0; i < R.perStage - 1; i++) { expect(s.hit(s.current!.answer)).toBe('correct'); s.advance(); }
    expect(s.waiting).toBe(false);
    s.waveEnd();                                                  // the last question's wave ends with no hit and no fall
    expect(ev.onCommit, 'onCommit fired inside waveEnd() itself').toHaveBeenCalledTimes(1);
    const preview = ev.onCommit.mock.calls[0][0];
    expect(preview.won).toBe(true);
    // waveEnd() itself calls advance() right after its miss branch, so the mission is already showing its
    // stage-clear by the time this returns — proving the preview and the real end() agree even when both the
    // miss AND advance() happen inside the very same call.
    expect(ev.onStageClear).toHaveBeenCalledTimes(1);
    s.nextStage();
    expect(ev.onEnd.mock.calls[0][0]).toEqual(preview);
  });
  /**
   * #484 review round 2, B2: every case above uses `stages: 1`, where "the last question of the last stage"
   * and "the last question of ANY stage" are the same question — so a mutated boundary (`this.stage <
   * this.stages` weakened to `this.stage < this.stages - 1`, firing one stage early) passed every existing
   * test. A real mission has several stages; `onCommit` must stay silent through every one but the true last.
   */
  it("onCommit stays silent through every stage but the mission's actual last one", () => {
    const ev = events(); ev.onCommit = vi.fn();
    const s = new Session({ mode: 'mission', year: Y1, topic: topicById('y1-add')!, rng: rng(1), stages: 2 }, ev);
    s.start();
    for (let i = 0; i < Y1.perStage - 1; i++) { expect(s.hit(s.current!.answer)).toBe('correct'); s.advance(); }
    expect(s.hit(s.current!.answer)).toBe('correct');   // stage 1 of 2's last question
    expect(ev.onCommit, 'stage 1 of 2 is not the mission — onCommit must not preview it as won').not.toHaveBeenCalled();
    s.advance(); s.nextStage();
    for (let i = 0; i < Y1.perStage - 1; i++) { expect(s.hit(s.current!.answer)).toBe('correct'); s.advance(); }
    expect(s.hit(s.current!.answer)).toBe('correct');   // stage 2 of 2's last question — the true last one
    expect(ev.onCommit, 'stage 2 of 2 is the mission — onCommit must fire now').toHaveBeenCalledTimes(1);
  });
  /**
   * #484 review round 2, B3: no existing Endless/Sprint/Boss test ever wires a spy `onCommit`, so
   * `maybeCommitFinalStage()`'s `!this.ev.onCommit` clause always short-circuits first in the existing suite —
   * `!this.spec.staged` is never actually reached, so removing it passed everything. With `onCommit` wired,
   * a non-staged mode answering many questions correctly must never preview a "won" mission that does not
   * exist for it.
   */
  it('onCommit never fires for a non-staged mode, even with onCommit wired and many questions answered', () => {
    const ev = events(); ev.onCommit = vi.fn();
    const pool = topicsFor('year1').filter(t => t.input !== 'tracing');
    const s = new Session({ mode: 'sprint', year: Y1, pool, rng: rng(1) }, ev);
    s.start();
    for (let i = 0; i < 10; i++) { const c = s.current!; if (c.sequence) c.sequence.forEach(l => s.hit(l)); else s.hit(c.answer); s.advance(); }
    expect(ev.onCommit, 'sprint is never staged — onCommit must stay silent regardless').not.toHaveBeenCalled();
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
  it('a generator that throws ends the run instead of leaving it frozen mid-question (#444)', () => {
    const ev = events();
    const real = topicById('y1-add')!;
    let calls = 0;
    const flaky = { ...real, gen: (d: Parameters<typeof real.gen>[0], r: Parameters<typeof real.gen>[1]) => { calls++; if (calls > 1) throw new Error('boom'); return real.gen(d, r); } };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const s = new Session({ mode: 'mission', year: Y1, topic: flaky, rng: rng(3) }, ev);
    s.start();
    expect(s.hit(s.current!.answer)).toBe('correct');   // waiting flips true; the next draw is what throws
    s.advance();
    expect(s.ended).toBe(true);
    expect(ev.onEnd).toHaveBeenCalledTimes(1);
    expect(ev.onEnd.mock.calls[0][0].won).toBe(false);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining(real.id), expect.any(Error));
    spy.mockRestore();
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

/**
 * #918: the "Slice Them All" engine. Fixture card from the issue's own worked example: targets {4, 8, 12},
 * decoys {3, 7}, delivered as a one-item deck so the test drives the exact `Question` object rather than a
 * real generator (no topic sets `anyOrder` yet — that is #920/#926–#928's job).
 */
describe('an any-order card: every target sliced, in any order (#918)', () => {
  const fixtureTopic = topicById('y1-add')!;
  const fixture: Question = {
    prompt: 'Slice 4, 8 and 12', answer: '4,8,12', sequence: ['4', '8', '12'], anyOrder: true,
    options: ['3', '4', '7', '8', '12'], hint: 'Slice every target, in any order', hintIsData: false,
  };
  const mkSession = (seed: number) => {
    const ev = events();
    const s = new Session({ mode: 'mission', year: Y1, deck: [{ topic: fixtureTopic, q: fixture }], rng: rng(seed) }, ev);
    s.start();
    return { s, ev };
  };
  it('slicing the targets out of order is correct once the last one goes, and the run ends won', () => {
    const { s, ev } = mkSession(1);
    expect(s.hit('12')).toBe('step');
    expect(s.remaining()).toEqual(['4', '8']);
    expect(s.hit('4')).toBe('step');
    expect(s.remaining()).toEqual(['8']);
    expect(s.hit('8')).toBe('correct');
    s.advance();   // a one-item deck ends here (#878's own advance()/nextDeckQuestion() wiring, unchanged by #918)
    expect(ev.onEnd).toHaveBeenCalledTimes(1);
    expect(ev.onEnd.mock.calls[0][0]).toMatchObject({ won: true, correct: 1, questions: 1 });
  });
  it('re-hitting an already-sliced target is wrong, and does not double-count it', () => {
    const { s } = mkSession(1.5);
    expect(s.hit('12')).toBe('step');
    expect(s.hit('12')).toBe('wrong');   // already sliced — not a fresh target, not a repeat of the same step
    expect(s.remaining()).toEqual(['4', '8']);   // still exactly the two left, '12' not re-added or dropped
  });
  it('a decoy mid-way is wrong, and does not consume a target', () => {
    const { s } = mkSession(2);
    expect(s.hit('12')).toBe('step');
    expect(s.hit('3')).toBe('wrong');   // decoy
    expect(s.remaining()).toEqual(['4', '8']);   // wrong slice loses the life, not a target
  });
  it('a fallen remaining target is a miss, ending the question', () => {
    const { s, ev } = mkSession(3);
    s.hit('12');
    s.fall('8');
    expect(ev.onMiss).toHaveBeenCalledTimes(1);
    expect(ev.onMiss.mock.calls[0][0]).toBe(fixture);
    expect(s.lives).toBe(Y1.lives - 1);
  });
  it('a fallen decoy is not a target and changes nothing', () => {
    const { s, ev } = mkSession(4);
    s.hit('12');
    s.fall('3');   // decoy falling
    expect(ev.onMiss).not.toHaveBeenCalled();
    expect(s.remaining()).toEqual(['4', '8']);
  });
  it('a wave end with targets left relaunches only the remaining ones, and slicing those still finishes correctly', () => {
    const { s, ev } = mkSession(5);
    s.hit('12');
    s.waveEnd();
    expect(ev.onQuestion).toHaveBeenCalledTimes(2);   // the relaunch, not a new question
    const labels = ev.onQuestion.mock.calls[1][1].labels as string[];
    expect(labels).not.toContain('12');
    expect(labels).toEqual(expect.arrayContaining(['4', '8']));
    // slicedTargets survived the relaunch: '12' stays done, only '4' and '8' are still needed
    expect(s.hit('4')).toBe('step');
    expect(s.hit('8')).toBe('correct');
    s.advance();
    expect(ev.onEnd).toHaveBeenCalledTimes(1);
    expect(ev.onEnd.mock.calls[0][0]).toMatchObject({ won: true });
  });
  it('two any-order questions in a row each start with a clean slicedTargets', () => {
    const q2: Question = { ...fixture, prompt: 'Slice again' };
    const ev = events();
    const s = new Session({ mode: 'mission', year: Y1, deck: [{ topic: fixtureTopic, q: fixture }, { topic: fixtureTopic, q: q2 }], rng: rng(6) }, ev);
    s.start();
    s.hit('12'); s.hit('4'); expect(s.hit('8')).toBe('correct');
    s.advance();   // onto the second any-order question
    expect(s.remaining()).toEqual(['4', '8', '12']);   // nothing carried over from the first
    expect(s.hit('12')).toBe('step');   // '12' is a fresh target again, not "already sliced"
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

describe('deck replay and misses (#878)', () => {
  const deckTopic = topicById('y1-add')!;
  /** `n` distinct questions (by `repeatKey`) from `deckTopic`, pre-generated the way a "Fix my mistakes" deck
   *  would be — never re-rolled or regenerated once play starts. */
  const buildDeck = (n: number, seed: number): DeckItem[] => {
    const gen = rng(seed); const seen = new Set<string>(); const deck: DeckItem[] = [];
    while (deck.length < n) {
      const q = deckTopic.gen(1, gen); const key = repeatKey(q);
      if (seen.has(key)) continue;
      seen.add(key); deck.push({ topic: deckTopic, q });
    }
    return deck;
  };
  it('a deck of 3 asks exactly those 3 prompts, in order, then ends', () => {
    const deck = buildDeck(3, 900); const ev = events();
    const s = new Session({ mode: 'mission', year: Y1, deck, rng: rng(901) }, ev);
    s.start();
    for (const item of deck) { expect(s.current).toBe(item.q); expect(s.hit(item.q.answer)).toBe('correct'); s.advance(); }
    expect(ev.onQuestion.mock.calls.map((c: any[]) => c[0])).toEqual(deck.map(d => d.q));
    expect(ev.onStageClear, 'a deck flattens the mode\'s own staging').not.toHaveBeenCalled();
    expect(ev.onEnd).toHaveBeenCalledTimes(1);
    const r = ev.onEnd.mock.calls[0][0];
    expect(r.won).toBe(true); expect(r.questions).toBe(3);
  });
  it('a deck works in a staged mode (mission) and an unstaged one (sprint) alike', () => {
    for (const mode of ['mission', 'sprint'] as const) {
      const deck = buildDeck(2, 910); const ev = events();
      const s = new Session({ mode, year: Y1, deck, rng: rng(911) }, ev);
      s.start();
      expect(s.hit(deck[0].q.answer)).toBe('correct'); s.advance();
      expect(s.hit(deck[1].q.answer)).toBe('correct'); s.advance();
      expect(ev.onEnd, mode).toHaveBeenCalledTimes(1);
      expect(ev.onEnd.mock.calls[0][0].won, mode).toBe(true);
    }
  });
  it('with no deck, every existing session test passes unchanged', () => {
    // #878's own acceptance criterion — asserted by the fact that every other test in this file constructs a
    // Session with no `deck` at all and still passes; this line just says so where the deck tests live.
    const ev = events();
    const s = new Session({ mode: 'mission', year: Y1, topic: deckTopic, rng: rng(920) }, ev);
    s.start();
    expect(s.o.deck).toBeUndefined();
  });
  it('a wrong slice records the picked label, a fall records null', () => {
    const deck = buildDeck(2, 930); const ev = events();
    const s = new Session({ mode: 'mission', year: Y1, deck, rng: rng(931) }, ev);
    s.start();
    const wrong = deck[0].q.options.find(o => o !== deck[0].q.answer)!;
    expect(s.hit(wrong)).toBe('wrong'); s.advance();
    s.fall(deck[1].q.answer); s.advance();
    const r = ev.onEnd.mock.calls[0][0];
    expect(r.misses).toEqual([
      { topic: deckTopic.id, q: deck[0].q, picked: wrong },
      { topic: deckTopic.id, q: deck[1].q, picked: null },
    ]);
  });
  it('a card missed twice keeps only its latest miss, moved to the end', () => {
    const [a, b] = buildDeck(2, 940);
    const deck = [a, b, a]; const ev = events();
    const s = new Session({ mode: 'sprint', year: Y1, deck, rng: rng(941) }, ev);
    s.start();
    const wrongA = a.q.options.find(o => o !== a.q.answer)!;
    expect(s.hit(wrongA)).toBe('wrong'); s.advance();              // a missed, picked recorded
    s.fall(b.q.answer); s.advance();                               // b missed, a fall
    s.fall(a.q.answer); s.advance();                                // a missed again, this time a fall
    const r = ev.onEnd.mock.calls[0][0];
    expect(r.misses, 'one entry for a, holding its latest miss, newest last').toEqual([
      { topic: deckTopic.id, q: b.q, picked: null },
      { topic: deckTopic.id, q: a.q, picked: null },
    ]);
  });
  it('25 distinct misses keep the latest 20, capped at MISSES_CAP', () => {
    const deck = buildDeck(25, 950); const ev = events();
    const s = new Session({ mode: 'sprint', year: Y1, deck, rng: rng(951) }, ev);
    s.start();
    for (const item of deck) { const wrong = item.q.options.find(o => o !== item.q.answer)!; expect(s.hit(wrong)).toBe('wrong'); s.advance(); }
    const r = ev.onEnd.mock.calls[0][0];
    expect(r.misses).toHaveLength(20);
    expect(r.misses.map((m: any) => m.q)).toEqual(deck.slice(5).map(d => d.q));
  });
  it('a deck session ends won: false when lives run out before the deck is exhausted', () => {
    const deck = buildDeck(5, 960); const ev = events();
    const s = new Session({ mode: 'mission', year: Y1, deck, rng: rng(961) }, ev);   // Y1: 3 lives, not gentle
    s.start();
    const wrongOf = (i: number) => deck[i].q.options.find(o => o !== deck[i].q.answer)!;
    for (let i = 0; i < Y1.lives; i++) { expect(s.hit(wrongOf(i))).toBe('wrong'); s.advance(); }
    expect(s.lives).toBe(0); expect(s.ended).toBe(true);
    expect(ev.onQuestion, 'the deck stops being served the moment lives hit zero').toHaveBeenCalledTimes(Y1.lives);
    const r = ev.onEnd.mock.calls[0][0];
    expect(r.won).toBe(false);
    expect(r.misses).toEqual(deck.slice(0, Y1.lives).map((d, i) => ({ topic: deckTopic.id, q: d.q, picked: wrongOf(i) })));
  });
  it('onCommit never fires for a deck session, even in a staged mode with a single stage', () => {
    // #878 review (silent-failure-hunter, pr-test-analyzer): a deck never moves `stage`/`index`, so
    // `maybeCommitFinalStage()` must not fire its staged-mission preview through a deck run.
    const deck = buildDeck(3, 970); const ev = events(); ev.onCommit = vi.fn();
    const s = new Session({ mode: 'mission', year: Y1, deck, stages: 1, rng: rng(971) }, ev);
    s.start();
    for (const item of deck) { expect(s.hit(item.q.answer)).toBe('correct'); s.advance(); }
    expect(ev.onCommit).not.toHaveBeenCalled();
    expect(ev.onEnd).toHaveBeenCalledTimes(1);
    expect(ev.onEnd.mock.calls[0][0].won).toBe(true);
  });
  it('a sequence question inside a deck steps letter by letter like any other', () => {
    const seqTopic = topicById('y1-sentence')!;
    const gen = rng(980);
    let q = seqTopic.gen(1, gen);
    while (!q.sequence) q = seqTopic.gen(1, gen);   // y1-sentence sequences from d1, but don't assume it forever
    const deck: DeckItem[] = [{ topic: seqTopic, q }];
    const ev = events();
    const s = new Session({ mode: 'mission', year: Y1, deck, rng: rng(981) }, ev);
    s.start();
    expect(s.current!.sequence).toBeDefined();
    expect(solve(s)).toBe('correct');
    s.advance();
    expect(ev.onEnd).toHaveBeenCalledTimes(1);
    expect(ev.onEnd.mock.calls[0][0]).toMatchObject({ won: true, correct: 1, questions: 1 });
  });
  /**
   * #878 review round 1, blocking finding 1: the previous "onCommit never fires for a deck session" test
   * passes even with `this.o.deck ||` deleted from `maybeCommitFinalStage()`'s guard, because every real
   * `YearInfo` has `perStage >= 5` — `this.index + 1 < this.perStage` (`0 + 1 < 6`) already short-circuits it
   * for a deck session, which never advances `index`. This test reaches the branch the guard actually exists
   * for, with a `YearInfo` shaped so `index + 1 >= perStage` — the guard's own removal turns this red.
   */
  it('the o.deck guard on maybeCommitFinalStage is load-bearing, not incidental (#878 review)', () => {
    const oneQuestionYear = { ...Y1, perStage: 1 };
    const deck = buildDeck(3, 990); const ev = events(); ev.onCommit = vi.fn();
    const s = new Session({ mode: 'mission', year: oneQuestionYear, deck, stages: 1, rng: rng(991) }, ev);
    s.start();
    expect(s.hit(deck[0].q.answer)).toBe('correct');
    expect(ev.onCommit, 'perStage:1 makes index+1 >= perStage true after the first question — only the explicit o.deck guard keeps this silent').not.toHaveBeenCalled();
  });
  /**
   * #878 review round 2, blocking finding: every deck test built its deck from a single `Topic`
   * (`deckTopic`), so nothing distinguished `nextDeckQuestion()` reading each item's own `topic` from a bug
   * that pinned every item to the first one's. "Fix my mistakes" (#930) and "Recent slips" (#938) — the two
   * features #878 exists for — are, by their own description, decks spanning many topics, and `Miss.topic`
   * is a field #878 itself introduces, so a mis-attribution here would silently corrupt it.
   */
  it('each deck item is served under its own topic, not the first item\'s (#878 review)', () => {
    const topicA = topicById('y1-add')!; const topicB = topicById('y1-sub')!;
    const qA = topicA.gen(1, rng(1000)); const qB = topicB.gen(1, rng(1001));
    const deck: DeckItem[] = [{ topic: topicA, q: qA }, { topic: topicB, q: qB }];
    const ev = events();
    const s = new Session({ mode: 'sprint', year: Y1, deck, rng: rng(1002) }, ev);
    s.start();
    expect(s.currentTopic).toBe(topicA);
    const wrongA = qA.options.find(o => o !== qA.answer)!;
    expect(s.hit(wrongA)).toBe('wrong'); s.advance();
    expect(s.currentTopic, 'the second item keeps its own topic, not the first item\'s').toBe(topicB);
    const wrongB = qB.options.find(o => o !== qB.answer)!;
    expect(s.hit(wrongB)).toBe('wrong'); s.advance();
    const r = ev.onEnd.mock.calls[0][0];
    expect(r.misses).toEqual([
      { topic: topicA.id, q: qA, picked: wrongA },
      { topic: topicB.id, q: qB, picked: wrongB },
    ]);
  });
  /**
   * #878 review round 3, blocking finding: every mission-mode deck test used 2–5 items against `Y1.perStage`
   * (6), so `advance()`'s `this.o.deck ||` guard — the sibling of `maybeCommitFinalStage()`'s round-1 guard —
   * was never exercised past `this.index < this.perStage`. A deck at least as long as `perStage`, in a staged
   * mode, is exactly what "Fix my mistakes" (#930) and "Recent slips" (#938) need and what the PR's own doc
   * comment claims works ("a deck works identically in a staged mode... and an unstaged one").
   */
  it('a mission-mode deck at least as long as perStage still flattens fully (#878 review)', () => {
    const deck = buildDeck(Y1.perStage + 2, 1010); const ev = events();
    const s = new Session({ mode: 'mission', year: Y1, deck, rng: rng(1011) }, ev);
    s.start();
    for (const item of deck) { expect(s.current).toBe(item.q); expect(s.hit(item.q.answer)).toBe('correct'); s.advance(); }
    expect(ev.onStageClear, 'a deck never triggers a stage clear, however long').not.toHaveBeenCalled();
    expect(ev.onQuestion.mock.calls.map((c: any[]) => c[0])).toEqual(deck.map(d => d.q));
    expect(ev.onEnd).toHaveBeenCalledTimes(1);
    const r = ev.onEnd.mock.calls[0][0];
    expect(r.won).toBe(true); expect(r.questions).toBe(deck.length);
  });
});

/**
 * #878 review round 1, blocking finding 2: every `.misses` assertion added by #878 lived inside
 * `describe('deck replay and misses (#878)')`, so a plain generated session — mission, sprint, endless, boss,
 * the common case, not the new one — was never checked to populate `misses` on its own `SessionResult`.
 */
describe('misses without a deck (#878 review)', () => {
  it('a plain generated session (no deck) also records misses', () => {
    const ev = events();
    const s = new Session({ mode: 'sprint', year: Y1, topic: topicById('y1-add')!, rng: rng(996) }, ev);
    s.start();
    const q1 = s.current!;
    const wrong = q1.options.find(o => o !== q1.answer)!;
    expect(s.hit(wrong)).toBe('wrong'); s.advance();
    const q2 = s.current!;
    s.fall(q2.answer); s.advance();
    s.tick(60_000);
    const r = ev.onEnd.mock.calls[0][0];
    expect(r.misses).toEqual([
      { topic: 'y1-add', q: q1, picked: wrong },
      { topic: 'y1-add', q: q2, picked: null },
    ]);
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
  it('a gentle year\'s boss never heals — a slip still costs a life, but never gives HP back (#700)', () => {
    const ev = events();
    const s = new Session({ mode: 'boss', year: R, pool: topicsFor('reception').filter(t => t.input !== 'tracing'), rng: rng(31) }, ev);
    s.start();
    const before = s.bossHp;
    expect(s.hit(wrongOf(s))).toBe('wrong');
    expect(s.bossHp, 'a gentle year never heals the boss').toBe(before);
    expect(ev.onBoss).not.toHaveBeenCalled();
    expect(s.lives).toBe(R.lives - 1);                       // wrong slices still cost a life — gentle only spares a miss
    s.advance();
    s.fall(s.current!.sequence ? s.current!.sequence[0] : s.current!.answer);
    expect(s.bossHp, 'a fall does not heal a gentle boss either').toBe(before);
    expect(s.lives, 'gentle: the miss itself costs no life').toBe(R.lives - 1);
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
 * `repeatGiveUps` — the re-roll's own signal that it exhausted its five tries and still served a repeat
 * (#453 item 4). The statistical rail near the bottom of this file asserts it at zero across every real,
 * large topic; these two are the deterministic case either side of that: a topic with nowhere else to go
 * bumps it every time, and a topic with anywhere else to go never bumps it at all.
 */
describe('repeatGiveUps — the re-roll give-up counter (#453 item 4)', () => {
  const stuck: Topic = { id: 'test-stuck', title: 'test', icon: '🔧', subject: 'maths', year: 'year1', nc: '',
    gen: () => ({ prompt: 'Which is bigger?', answer: 'cat', options: ['cat', 'dog'] }) };

  it('bumps once per question when the topic has only one card to offer', () => {
    const s = new Session({ mode: 'mission', year: Y1, topic: stuck, rng: rng(1) }, events());
    s.start();
    expect(s.repeatGiveUps).toBe(0);   // nothing asked yet to repeat against
    for (let i = 0; i < 4; i++) s.nextQuestion();
    expect(s.repeatGiveUps).toBe(4);   // every question after the first repeats the one before it
  });

  it('never bumps when the topic has more than one card to alternate between', () => {
    let turn = 0;
    const alternating: Topic = { id: 'test-alternating', title: 'test', icon: '🔧', subject: 'maths', year: 'year1', nc: '',
      gen: () => ({ prompt: 'a', answer: turn++ % 2 === 0 ? '1' : '2', options: ['1', '2'] }) };
    const s = new Session({ mode: 'mission', year: Y1, topic: alternating, rng: rng(1) }, events());
    s.start();
    for (let i = 0; i < 20; i++) s.nextQuestion();
    expect(s.repeatGiveUps).toBe(0);
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
 * **What these rails cover, enumerated by carrier rather than summarised** — because the sentence that used to
 * sit here has now been wider than the truth twice (rounds 2 and 3), each time on a carrier the previous
 * wording had not thought of. So this is a table, not an adjective:
 *
 * | the question is carried by | covered here |
 * | --- | --- |
 * | `prompt`, `answer`, `hint`, `listen`, `sequence` | **yes** — `asked()` reads all five |
 * | `coins`, `numberline`, `chart` | **yes** — `asked()` reads them too, independently of `VISUAL_QUESTION` (#455) |
 * | `objects`, `sentence`, `strip`, `symmetry` (the `VISUAL_QUESTION` names with no other carrier) | **no rail here** — see below |
 * | `options`, where the generator sets `optionsAreContent` | **yes** — `asked()` reads it too (#451) |
 * | `options`, everywhere else | **no**, deliberately — see below |
 *
 * These four names still get **no rail in this describe**, which round 3's version of this table got wrong
 * (round 4, note 1): `asked()` omits them, so deleting any single one of the four leaves both exact rails
 * green and only the pre-existing #390 band rail above reddens — and only for a topic that band rail's own
 * filter finds, which `strip`'s one topic (`y2-patterns`) does not (its d1 cards offer four bubbles, not two).
 * `strip` is exactly the fourth entry this paragraph already predicted before #391 added it: "a new topic
 * carrying its question in an `objects`/`sentence`/`symmetry`-like visual with a varying prompt would reach no
 * rail in this file" — true of `y2-patterns` in both its `sentence` days and its `strip` ones, and left that
 * way deliberately rather than widened here, which is outside #391's scope. `coins`/`numberline`/`chart` do
 * not share that gap: `asked()` reads them directly (#455), so deleting one of those three from
 * `VISUAL_QUESTION` now reddens `two cards that ask the same thing never take two keys` below, the key having
 * fallen behind the oracle it is measured against.
 *
 * `options` is keyed only where the generator opts in with `optionsAreContent` (#451): unconditionally folding
 * it in for every topic switches de-duplication off wherever the field is decoration. `options` are a decoy
 * pool on forty-odd topics, which is why `the key ignores every field that carries presentation` still pins
 * the default exclusion; and a `word` visual carries `orderQ`'s *shuffled* display, so `y2-order` is correctly
 * outside rather than missed. `intervalCompare` is the one generator that sets it, because it sets no `hint`,
 * `listen` or visual and its own comment says the bubbles *are* the durations — `asked()` below reads
 * `options`, sorted, on exactly the same condition the key does, so the rails below now cover `y2-duration`.
 *
 * So: no rail here names a topic, and within the carriers marked yes, a new topic is covered the day it ships.
 * The adjective-shaped version of that sentence is the mistake this file diagnoses two paragraphs up, and it
 * has twice been this file's own.
 */
describe('the repeat key holds the whole question (#412)', () => {
  const D1 = 1 as const;
  const yearOf = (t: { year: string }) => YEARS.find(y => y.id === t.year)!;
  /**
   * Everything the card asks: what a child reads on it, hears from it, and must slice. No decoration — and a
   * delimited list is a **set**, because three generators build one from a per-draw shuffle (round 1, B1).
   *
   * The field list is written from the `Question` contract rather than read off `repeatKey`, so it is the
   * requirement and the key is the thing under test. **The normalisation is deliberately wider than the key's**
   * (round 2, B2): `contentList` in `src/game/session.ts` knows four separators, and this oracle knows five —
   * the same four plus `', '`. Narrowing the key's four goes red here only once a generator actually uses the
   * dropped separator: change `soundQ`'s `listen` join to `', '` and round 1's defect returns at 1.2% with
   * every rail green, because the oracle would fail to normalise it in exactly the same way, going red on
   * `two cards that ask the same thing never take two keys` below. Narrowing on its own, with no generator
   * using the dropped separator, is invisible to every rail here (#465).
   *
   * Being coarser than the key can only produce a red, never hide one, and the red is informative: it needs two
   * questions that are permutations of each other's list items, which is a card a child cannot tell apart by
   * reading either. Today there are none — `', '` appears in four sentence topics' prose and collides with
   * nothing.
   *
   * What neither this nor the key sees, everywhere `optionsAreContent` is unset: `options`, and the four
   * `VISUAL_QUESTION` types `asked()` does not read directly (`objects`, `sentence`, `strip`, `symmetry`). The
   * describe header enumerates it by carrier.
   */
  const asked = (q: Question) => {
    // A superset of the key's own list, which is the point: `', '` is here and deliberately not there, because
    // prose commas must not merge two cards in the key but may safely red this rail (round 2, B2; round 4, note 3).
    const LIST_SEPARATORS = [' · ', ' | ', '; ', ' / ', ', '];
    const set = (s: string) => {
      for (const sep of LIST_SEPARATORS) if (s.includes(sep)) return s.split(sep).sort().join(sep);
      return s;
    };
    // #455's three carriers read here too, independently of `VISUAL_QUESTION` — this is the requirement, not a
    // copy of the key under test. `objects`/`sentence`/`strip`/`symmetry` stay unread: the pre-existing gap the
    // table above notes, left uncovered by the `constantPromptBinary` band rail too for `strip` specifically
    // (#391) — `y2-patterns` does not have that rail's binary-options shape.
    const v = q.visual;
    const visual = v?.type === 'coins' ? [...new Set(v.coins)].sort((a, b) => a - b).join('/')
      : v?.type === 'numberline' ? `${v.from}/${v.to}/${v.mark ?? ''}/${v.step ?? ''}`
      : v?.type === 'chart' ? `${v.kind}/${v.rows.map(r => r.n).join(',')}`
      : '';
    // #451: the same opt-in the key reads — `options` is a re-shuffled decoy pool everywhere else, so folding
    // it in unconditionally would make this oracle too fine, the B1 direction #412's own review already found.
    const options = q.optionsAreContent ? [...q.options].sort().join('\u0001') : '';
    return [q.prompt, q.answer, set(q.hint ?? ''), set(q.listen ?? ''), (q.sequence ?? []).join('\u0001'), visual, options].join('\u0000');
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
   *
   * **3,000 draws, not 700** (round 4, note 2): at 700, `y1-capacity` produced 700 distinct groups, so the `else`
   * holding the assertion never ran and its case passed without evaluating anything. Its first duplicate is at
   * draw 805. A rail that cannot reach its own `expect` on a topic is not covering it.
   */
  it.each(playable.map(t => t.id))('%s: two cards that ask the same thing never take two keys', (id) => {
    const topic = topicById(id)!;
    for (const d of [1, 2, 3] as const) {
      const r = rng(11);
      const byAsked = new Map<string, { key: string; q: Question }>();
      for (let i = 0; i < 3000; i++) {
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
   * one judgement `session.ts` defends at length and, when this rail was written, nothing held it: folding
   * `q.say` in was **176/176 green** then, while switching de-duplication off on `r-order`, whose `say` speaks
   * the numbers in their shuffled display order (round 1, note 1). That figure is kept as the reason this rail
   * exists, not as a current measurement — **at this head the same mutation reddens 14 cases**, mostly on the
   * converse rail this pull request added, so the judgement is better held than the sentence used to claim
   * (round 4, note 4). `options` is re-shuffled every draw, and `wide`/`peek`/`slow` are how a card is
   * presented, not what it asks.
   */
  it('the key ignores every field that carries presentation rather than content', () => {
    for (const t of playable) {
      const q = t.gen(D1, rng(3));
      const base = repeatKey(q);
      const presentation: Partial<Omit<Question, 'hint' | 'hintIsData'>>[] = [
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
   * The rail above runs at d1 only, and `y2-duration`'s d1 branch is the plain numeric-fact generator, not
   * `intervalCompare` — so it never actually exercises `optionsAreContent` (`options` there is decoration, the
   * flag is unset, and the reversal it tries is the no-op every other topic gets). This is that direct case,
   * at d2 where `intervalCompare` runs, on a real generated card rather than a hand-built one: order is
   * ignored, a different set of durations is not, and turning the flag off returns to the old, coarser key.
   */
  it('optionsAreContent normalises option order but not option identity (#451)', () => {
    const topic = topicById('y2-duration')!;
    const q = topic.gen(2, rng(5));
    expect(q.optionsAreContent, 'this draw did not exercise intervalCompare').toBe(true);
    const base = repeatKey(q);
    expect(repeatKey({ ...q, options: [...q.options].reverse() }), 'order').toBe(base);
    expect(repeatKey({ ...q, options: [...q.options, 'a duration not really on this card'] }), 'a genuinely different set').not.toBe(base);
    expect(repeatKey({ ...q, optionsAreContent: false }), 'the flag itself').not.toBe(base);
  });

  /**
   * Per topic at d1: the generator's own consecutive-agreement rate, the rate a driven `Session` produces, and
   * how many distinct cards there are per distinct answer. Computed once — three of these numbers are wanted
   * by the discovery and by the assertion, and a second pass would double the cost of the file.
   *
   * **d1 only** (round 2, N5): these drive `nextQuestion` without answering, so the stage never advances and
   * the difficulty never moves. The exact rails above do sweep d1/d2/d3, and round 2 checked d2/d3 here
   * independently and found nothing, so this is a limit on the coverage rather than a hole under a claim.
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
    const contents = new Set(cards.map(asked)).size, answers = new Set(cards.map(c => c.answer)).size;
    return {
      id: t.id,
      baseline: base / PAIRS,
      inSession: same / PAIRS,
      repeated: sameCard / PAIRS,
      contents,
      answers,
      perAnswer: contents / answers,
      giveUps: s.repeatGiveUps,
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
   *
   * `answers >= 2` keeps out a case that would run and pin nothing (round 2, N3): `y1-plurals` has one answer
   * at d1, so both rates are 1.000 and the assertion reads `1.000 > 0.500` whatever `repeatKey` does.
   */
  const measurable = stats.filter(s => s.perAnswer >= 4 && s.answers >= 2 && s.baseline * PAIRS >= 30);

  /**
   * Pinned exactly, not just counted (#453 item 3). A bare `toBeGreaterThanOrEqual` cannot tell "the right ten"
   * from "ten, three of them swapped out" — several topics could drop out of this set together, in silence,
   * as long as as many others happened to cross the threshold the same run. Listing the set exactly is the same
   * discipline PR #692 already applies to the `' · '` hint/listen inventory: a topic joining or leaving is a
   * deliberate edit to this list, not a number that still happens to clear a floor.
   */
  const MEASURABLE_TOPICS = [
    'r-soundhunt', 'y1-add', 'y1-balance', 'y1-capacity', 'y1-length', 'y1-mass', 'y1-missing', 'y1-soundhunt',
    'y1-spelling', 'y1-sub', 'y2-balance', 'y2-capacity', 'y2-compare', 'y2-inverse', 'y2-length', 'y2-mass',
    'y2-oddeven', 'y2-punct', 'y2-pv', 'y2-spelling', 'y2-stats', 'y2-temp', 'y2-three',
  ];
  it('the measurable set is exactly these topics, not just this many (#453 item 3)', () => {
    // The two extremes of the issue's own table are in this list: the listening topics, where the key *was* the
    // answer, and a measurement topic, where the values live in `hint`. `y2-punct` scrapes in at exactly 4.00
    // cards per answer (round 2, N2) — the one that would otherwise drop out of this rail in silence.
    expect(measurable.map(s => s.id).sort()).toEqual([...MEASURABLE_TOPICS].sort());
  });

  it.each(measurable.map(s => s.id))('%s: a driven session repeats an answer about as often as the generator does', (id) => {
    const s = measurable.find(x => x.id === id)!;
    // Half the generator's rate, not a fixed number: the point is that the sequence adds no signal of its own.
    // The measured gap before the fix was total — 0.000 against 0.061 on both sound-hunt topics — and after it
    // every topic in this set sits within a few percent of its baseline, so the floor is nowhere near either.
    //
    // Read this as a **backstop against total suppression, not a second independent net** (round 2, N1). With
    // the pre-#412 key restored it reddens only the two sound-hunt topics: the seven measurement topics land at
    // 0.52–0.87 against the 0.5 floor, `y2-temp` at 0.52 with 4% of margin. Rail 1 is what catches all nine,
    // which is what the describe header says carries the load.
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
   * account for anything at this scale.
   *
   * The bound is a thousandth, which over `PAIRS` transitions **is a tolerance of exactly one** (round 2, N6):
   * 1/1500 = 0.00067 passes and two repeats do not. That is deliberate rather than tight — the broken state
   * read 1.11%, sixteen repeats' worth — but it is a tolerance of one and not of zero, and saying otherwise
   * was this comment's own overclaim.
   */
  const bigEnough = stats.filter(s => s.contents >= 50);
  /** Pinned exactly, for the same reason as `MEASURABLE_TOPICS` above (#453 item 3): a count cannot distinguish
   *  "these twenty-eight" from "twenty-eight, several of them not the ones B1 was measured on". */
  const BIG_ENOUGH_TOPICS = [
    'r-soundhunt', 'y1-add', 'y1-balance', 'y1-capacity', 'y1-length', 'y1-mass', 'y1-missing', 'y1-moreless',
    'y1-order', 'y1-soundhunt', 'y1-spelling', 'y1-sub', 'y2-add', 'y2-balance', 'y2-capacity', 'y2-compare',
    'y2-inverse', 'y2-length', 'y2-line', 'y2-mass', 'y2-order', 'y2-pv', 'y2-skip', 'y2-spelling', 'y2-stats',
    'y2-sub', 'y2-temp', 'y2-three',
  ];
  it('the big-topic set is exactly these topics, not just this many (#453 item 3)', () => {
    expect(bigEnough.map(s => s.id).sort()).toEqual([...BIG_ENOUGH_TOPICS].sort());
  });

  it.each(bigEnough.map(s => s.id))('%s: a driven session never serves the same question twice running', (id) => {
    const s = bigEnough.find(x => x.id === id)!;
    expect(s.repeated, `served the same question back to back ${(100 * s.repeated).toFixed(3)}% of the time over ${s.contents} distinct cards`)
      .toBeLessThan(0.001);
  });

  /**
   * The re-roll's own give-up counter (#453 item 4): on a topic with at least fifty distinct cards, five tries
   * should always find a non-repeat, so `repeatGiveUps` staying at zero here is what makes "the key has
   * collapsed" an assertable fact rather than something only a much rarer repeat (the rail above, `< 0.001`)
   * would eventually hint at.
   */
  it.each(bigEnough.map(s => s.id))('%s: the re-roll never gives up over a driven session', (id) => {
    const s = bigEnough.find(x => x.id === id)!;
    expect(s.giveUps, `re-roll exhausted five tries and still served a repeat ${s.giveUps} time(s) over ${PAIRS} questions`).toBe(0);
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
    // Drives a real stage and checks the stage star is this function applied to the stage accuracy — at this
    // one accuracy, `Session`'s own star and a fresh call to the bar must agree. **Not** a guarantee that
    // `Session` still calls `starsForAccuracy` at all (#409 item 3): replacing the call in `session.ts` with
    // the identical inline ternary leaves this green too, because the two sides of the `toBe` would then
    // compute the same number by two independent routes rather than share one. Catching a lost call would need
    // a spy on the module's own export, not a value comparison — a different test than this one.
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

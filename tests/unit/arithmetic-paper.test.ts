// Arithmetic practice (#1233): the ten-card deck, the mode row, the recap and the pace line.
import { describe, it, expect, vi } from 'vitest';
import { PAPER_SECONDS, PAPER_SIZE, paceLine, paperCard, paperDeck, paperRecap } from '../../src/game/arithmetic-paper';
import { MODES } from '../../src/game/modes';
import { Session, type SessionEvents, type SessionResult } from '../../src/game/session';
import { YEARS } from '../../src/curriculum';
import { seededRng } from '../../src/game/rng';
import { paperRowsFor } from '../../src/ui/paper-view';

const digits = (s: string) => (s.match(/\d/g) ?? []).length;
const Y6 = YEARS.find(y => y.id === 'year6')!;

describe('paperDeck', () => {
  it('is ten cards drawn in the form\'s rising order, each built or picked by the six-slot rule', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const deck = paperDeck(seededRng(seed));
      expect(deck).toHaveLength(PAPER_SIZE);
      for (const { q } of deck) {
        if (digits(q.answer) <= 6) { expect(q.build, q.prompt).toBeDefined(); expect(q.sequence!.join('')).toBe(q.answer.replace(/\D/g, '')); }
        else { expect(q.build).toBeUndefined(); expect(q.options).toHaveLength(4); expect(new Set(q.options).size).toBe(4); expect(q.options).toContain(q.answer); }
      }
    }
  });
  it('gives pick-one cards wrong answers in the answer\'s own shape', () => {
    const c = paperCard({ prompt: '9,999 × 99 × 9 =', answer: '8,909,109' }, seededRng(3));
    expect(c.options).toHaveLength(4);
    for (const o of c.options) expect(o).toMatch(/^\d,\d{3},\d{3}$/);
  });
  it('is the same deck for the same seed', () => {
    expect(paperDeck(seededRng(7)).map(d => d.q.prompt)).toEqual(paperDeck(seededRng(7)).map(d => d.q.prompt));
  });
});

describe('MODES.paper', () => {
  it('is a 450-second clock with no lives, stars on correct ÷ 10', () => {
    const m = MODES.paper;
    expect(PAPER_SECONDS).toBe(450); expect(m.seconds).toBe(450); expect(m.timed).toBe(true); expect(m.hasLives).toBe(false);
    expect(m.resultStars).toBe(true); expect(m.overHeadingWon).toBe('Practice paper done!');
    const e = (correct: number) => m.stars({ won: true, score: 0, correct, accuracy: 0, stageStarsTotal: 0, stages: 5, stars: 0, year: Y6 });
    expect([0, 1, 6, 7, 9, 10].map(e)).toEqual([0, 1, 1, 2, 2, 3]);
  });
});

describe('a paper run', () => {
  const run = (answered: number, seconds?: number) => {
    const deck = paperDeck(seededRng(5)); const onEnd = vi.fn();
    const s = new Session({ mode: 'paper', year: Y6, deck, rng: seededRng(1) }, { onQuestion() {}, onCorrect() {}, onWrong() {}, onMiss() {}, onProgress() {}, onLives() {}, onStageClear() {}, onEnd } as unknown as SessionEvents);
    s.start();
    for (let i = 0; i < answered; i++) {
      const q = s.current!;
      if (i === 1) s.hit(q.options.find(o => o !== (q.sequence?.[0] ?? q.answer))!);   // one wrong slice
      else for (const l of q.sequence ?? [q.answer]) s.hit(l);
      s.advance();
    }
    if (seconds) s.tick(seconds * 1000);
    return { s, onEnd, deck };
  };
  it('reads its 450 s clock from the mode, and ends at the tenth answer with the elapsed time', () => {
    const { s, onEnd } = run(0); expect(s.secondsLeft).toBe(450);
    s.tick(12_000); expect(s.secondsLeft).toBe(438);
    const done = run(10); expect(done.onEnd).toHaveBeenCalledTimes(1);
    const r = done.onEnd.mock.calls[0][0];
    expect(r.won).toBe(true); expect(r.attempts).toBe(10); expect(r.correct).toBe(9); expect(r.misses).toHaveLength(1); expect(r.elapsedMs).toBe(0);
    expect(onEnd).not.toHaveBeenCalled();
  });
  it('ends when the clock runs out, leaving the rest unreached', () => {
    const { onEnd, deck } = run(4, 450);
    const r = onEnd.mock.calls[0][0];
    expect(r.attempts).toBe(4); expect(r.elapsedMs).toBe(450_000);
    expect(paperRecap(deck, r.misses, r.attempts).unreached).toHaveLength(6);
  });
});

describe('paperRecap and the rows', () => {
  const deck = paperDeck(seededRng(11));
  const miss = (i: number, picked: string | null) => ({ topic: 'y6-paper', q: deck[i].q, picked });
  it('lists each missed question with its answer, and every unasked one as not reached', () => {
    const r = paperRecap(deck, [miss(1, '5'), miss(3, null)], 6);
    expect(r.missed.map(m => m.prompt)).toEqual([deck[1].q.prompt, deck[3].q.prompt]);
    expect(r.missed[0].answer).toBe(deck[1].q.answer);
    expect(r.unreached.map(u => u.prompt)).toEqual(deck.slice(6).map(d => d.q.prompt));
  });
  it('says the paper\'s pace and the child\'s', () => {
    expect(paceLine(120_000, 10)).toBe('Paper pace: 45 s a question · yours: 12 s');
    expect(paceLine(0, 0)).toBeNull();
  });
  it('renders the rows as escaped text, and nothing for another mode', () => {
    const base: SessionResult = { mode: 'paper', stage: 1, won: true, score: 0, stars: 0, stageStars: [] as number[], correct: 5, attempts: 6, bestCombo: 0, questions: 6, coins: 0, misses: [miss(1, '5')], elapsedMs: 60_000 };
    const html = paperRowsFor({ ...base }, deck);
    expect(html).toContain('Paper pace: 45 s a question · yours: 10 s');
    expect(html).toContain('Answer: ' + deck[1].q.answer.replace(/&/g, '&amp;'));
    expect(html.match(/Not reached/g)).toHaveLength(4);
    expect(paperRowsFor({ ...base, mode: 'sprint' }, deck)).toBe('');
  });
});

// #1120: on the number pad the digits showing when the 6 s run out are the answer, as in the real check.
import { describe, it, expect } from 'vitest';
import { mtcDeck, MTC_PRACTICE } from '../../src/game/mtc';
import { Session } from '../../src/game/session';
import { YEARS } from '../../src/curriculum';
import { seededRng } from '../../src/game/rng';

const noop = () => {};
/** Play the 3 practice cards, then let card 4 time out with `typed(answer)` on the pad. */
function timeOut(typed: (answer: string) => string) {
  const out = { right: 0, wrong: 0, miss: 0 };
  const ev = { onQuestion: noop, onCorrect: () => out.right++, onWrong: () => out.wrong++, onMiss: () => out.miss++, onProgress: noop, onLives: noop, onStageClear: noop, onBoss: noop, onTime: noop, onEnd: noop };
  const s = new Session({ mode: 'mtc', year: YEARS.find(y => y.id === 'year4')!, deck: mtcDeck(seededRng(5)) }, ev as never);
  s.start();
  for (let i = 0; i < MTC_PRACTICE; i++) { s.hit(s.current!.answer); s.advance(); }
  out.right = 0;   // the practice hits are not under test
  const shown = typed(s.current!.answer);
  s.pending = () => shown;
  s.armQuestionClock(ms => ms, true);
  s.tick(5900);
  expect(out).toEqual({ right: 0, wrong: 0, miss: 0 });   // armed at once on a pad (no wave delay), and not early
  s.tick(200);
  return out;
}

describe('the 6 s running out on a pad card (#1120)', () => {
  it('scores the digits shown as right when they are the product', () => expect(timeOut(a => a)).toEqual({ right: 1, wrong: 0, miss: 0 }));
  it('scores a different number as wrong', () => expect(timeOut(a => a.slice(0, -1) || '0')).toEqual({ right: 0, wrong: 1, miss: 0 }));
  it('counts an empty pad as unanswered', () => expect(timeOut(() => '')).toEqual({ right: 0, wrong: 0, miss: 1 }));
});

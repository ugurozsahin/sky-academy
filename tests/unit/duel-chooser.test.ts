import { describe, expect, it } from 'vitest';
import { duelHeadline, duelPool } from '../../src/game/duel';
import { topicsFor, YEARS } from '../../src/curriculum';
import { duelChooserTopics } from '../../src/ui/chooser';

// #957: Ninja Duel's chooser lists exactly the open subject's topics that duelPool keeps.
describe('duelChooserTopics (#957)', () => {
  for (const year of YEARS.filter(y => topicsFor(y.id).length)) {
    for (const subject of ['maths', 'writing'] as const) {
      it(`${year.id} ${subject}: only topics in duelPool, nothing it screens out`, () => {
        const pool = new Set(duelPool(topicsFor(year.id), year.diffs[0] ?? 1).map(t => t.id));
        const listed = duelChooserTopics(year, subject);
        expect(listed.every(t => pool.has(t.id) && t.subject === subject)).toBe(true);
        expect(listed.every(t => t.input !== 'tracing')).toBe(true);
        expect(listed.some(t => t.drill)).toBe(false);
        const expected = topicsFor(year.id, subject).filter(t => pool.has(t.id)).map(t => t.id);
        expect(listed.map(t => t.id)).toEqual(expected);
      });
    }
  }
});

// #958: the match-end line reads the class-team names when given them, and a draw is unchanged.
describe('duelHeadline with class teams (#958)', () => {
  const tally = { a: { hits: 0, tries: 0 }, b: { hits: 0, tries: 0 } };
  const teams = { a: 'Team A', b: 'Team B' };
  it('names the winning team, and the default names are unchanged', () => {
    expect(duelHeadline({ winner: 'a', scoreA: 6, scoreB: 3, rounds: 10, tally }, teams)).toBe('Team A wins 6–3!');
    expect(duelHeadline({ winner: 'b', scoreA: 2, scoreB: 7, rounds: 10, tally }, teams)).toBe('Team B wins 7–2!');
    expect(duelHeadline({ winner: 'draw', scoreA: 4, scoreB: 4, rounds: 10, tally }, teams)).toBe("It's a draw — 4 all!");
    expect(duelHeadline({ winner: 'a', scoreA: 6, scoreB: 3, rounds: 10, tally })).toBe('Player 1 wins 6–3!');
  });
});

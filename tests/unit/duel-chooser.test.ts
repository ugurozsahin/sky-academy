import { describe, expect, it } from 'vitest';
import { duelPool } from '../../src/game/duel';
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

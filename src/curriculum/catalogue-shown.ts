// What a catalogue shows (#2192): the one definition of "shown" for an island and a game, read from a catalogue
// object (`src/config/catalogue.json`, #2193). Pure: the catalogue and the topic list are arguments, so a test copy,
// a user's patched copy (#2199) and the committed file all go through the same code. The Pages deploy (#2203)
// publishes media for exactly these; the website (#2201) and the game's own lists (#2195, #2196) are meant to read
// it too, so the rule lives here once.
import type { Catalogue } from '../config/catalogue';
import { isKs2 } from './key-stage';
import { meetsShowGate } from './shown';
import type { Topic, YearId } from './types';

/** The registry fields the gate counts by. `TOPICS` satisfies it. */
export type GateTopic = Pick<Topic, 'id' | 'year' | 'subject' | 'drill'>;

/** A game switched on for a year: its own `visible` and its year node's. Whether the island shows is separate. */
export function gameOn(cat: Catalogue, id: string, year: YearId): boolean {
  const g = cat.games[id];
  return !!g && g.visible === true && g.years[year]?.visible === true;
}

/**
 * An island shows when its `visible` is `true`, never when `false`, and on `"auto"` by today's gate
 * (`src/curriculum/index.ts`, #1032): every EYFS/KS1 island, and a KS2 island with enough maths and writing
 * topics. The gate counts the year's non-drill topics that the catalogue switches on, so hiding games can take a
 * KS2 island under its gate. With every game on, as in the committed file, that is exactly today's count.
 */
export function islandShown(cat: Catalogue, year: YearId, topics: readonly GateTopic[]): boolean {
  const v = cat.years[year]?.visible;
  if (v !== 'auto') return v === true;
  if (!isKs2(year)) return true;
  const count = (subject: GateTopic['subject']) =>
    topics.filter(t => t.year === year && t.subject === subject && !t.drill && gameOn(cat, t.id, year)).length;
  return meetsShowGate(true, count('maths'), count('writing'));
}

/** The islands and the games a catalogue shows, each in file order. A game shows when it is on for a year whose island shows. */
export function catalogueShown(cat: Catalogue, topics: readonly GateTopic[]): { years: YearId[]; games: string[] } {
  const years = (Object.keys(cat.years) as YearId[]).filter(y => islandShown(cat, y, topics));
  const games = Object.entries(cat.games)
    .filter(([id, g]) => (Object.keys(g.years) as YearId[]).some(y => years.includes(y) && gameOn(cat, id, y)))
    .map(([id]) => id);
  return { years, games };
}

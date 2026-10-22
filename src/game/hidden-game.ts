// #2197: a direct way into a game (a challenge code, "Play again", a deep link) must not open one the catalogue hides (#2196).
import { isGameShown, shownYears, topicById, type Topic, type YearInfo } from '../curriculum';

export const HIDDEN_LINE = 'This game is switched off in the grown-ups settings.' as const;

/** True when `topic` is a registry game the catalogue hides for its year. A Tricky Facts-style deck topic built for one run (no registry row) is never blocked. */
export const gameHidden = (topic: Topic | undefined): boolean => !!topic && !!topicById(topic.id) && !isGameShown(topic.id, topic.year);

/** Where a blocked start lands: the game's island, or the map (`null`) when that island is hidden too. */
export const landingFor = (year: YearInfo): YearInfo | null => shownYears().find(y => y.id === year.id) ?? null;

/** #2197: the one guard every `nav.play` start goes through. True when it refused: the island with the notice, or the map when that island is hidden too (by design, no notice there). */
export function blockedStart(topic: Topic | undefined, year: YearInfo, nav: { island: (y: YearInfo, notice: typeof HIDDEN_LINE) => void; map: () => void }): boolean {
  if (!gameHidden(topic)) return false;
  const land = landingFor(year);
  if (land) nav.island(land, HIDDEN_LINE); else nav.map();
  return true;
}

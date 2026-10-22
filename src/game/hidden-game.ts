// #2197: a direct way into a game (a challenge code, "Play again", a deep link) must not open one the catalogue hides (#2196).
import { isGameShown, shownYears, topicById, type Topic, type YearInfo } from '../curriculum';

export const HIDDEN_LINE = 'This game is switched off in the grown-ups settings.';

/** True when `topic` is a registry game the catalogue hides for its year. A built-for-one-run drill (no registry row) is never blocked. */
export const gameHidden = (topic: Topic | undefined): boolean => !!topic && !!topicById(topic.id) && !isGameShown(topic.id, topic.year);

/** Where a blocked start lands: the game's island, or the map (`null`) when that island is hidden too. */
export const landingFor = (year: YearInfo): YearInfo | null => shownYears().find(y => y.id === year.id) ?? null;

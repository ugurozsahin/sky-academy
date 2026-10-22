// What a play start hands the session as its `year` (#2198, #1297): one game on its own reads its own resolved
// settings; every mixed mode (Sensei, Legend, mixed, Daily, Duel, a fix-my-mistakes deck, MTC/paper) keeps the
// mode table and the year's. A Pro run (#1297) is then `proYear` of whichever year that was.
import type { Topic, YearInfo } from '../curriculum/types';
import { gameYear } from '../config/resolve';
import { proYear } from './modes';

interface Start { year: YearInfo; topic?: Topic; pool?: Topic[]; deck?: readonly unknown[]; legend?: boolean; pro?: boolean }

/** One topic, no pool, no deck, not Legend: a single game played on its own. */
export const playsAlone = (o: Start): boolean => !!o.topic && !o.pool && !o.deck && !o.legend;

/** `o` with the `year` the session plays; `o` itself when nothing changes it. `o.year` stays canonical for the caller. */
export function played<T extends Start>(o: T): T {
  const alone = playsAlone(o), year = alone ? gameYear(o.year, o.topic!.id) : o.year;
  return o.pro ? { ...o, year: proYear(year) } : alone ? { ...o, year } : o;
}

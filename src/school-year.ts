// #1055: the child's school year, kept in `ks2.schoolYear` (#1054) and never confused with `SaveData.year`
// (the last island opened). Pure: no storage import, so the map, the grown-ups settings and the first
// mission can all ask it the same question.
import { shownYears, YEARS, type YearId } from './curriculum';

/** Reception is 0, Year n is n — the order `YEARS` already lists, for the birthday helper's arithmetic. */
const LEVELS: readonly YearId[] = ['reception', 'year1', 'year2', 'year3'];

/** The year to start a child on: the stored school year if shown, else the nearest shown year below it. */
export function placementYear(d: { ks2: { schoolYear?: YearId } }, shownNow: readonly { id: YearId }[] = shownYears()): YearId | undefined {
  const stored = d.ks2.schoolYear;
  if (!stored) return undefined;
  const shown = new Set(shownNow.map(y => y.id));
  for (let i = YEARS.findIndex(y => y.id === stored); i >= 0; i--) if (shown.has(YEARS[i].id)) return YEARS[i].id;
  return undefined;
}

/** The usual year group for a birth date on `today`: 0 is Reception, n is Year n, `null` outside Reception–Year 6.
 *  A school year runs 1 September to 31 August, so only the birth year and whether it is September or later matter. */
export function schoolYearFromBirthDate(birth: Date, today: Date): number | null {
  const startYear = today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1;
  const n = startYear - birth.getFullYear() - (birth.getMonth() >= 8 ? 1 : 0) - 4;
  return n >= 0 && n <= 6 ? n : null;
}

/** The `YearId` a birthday helper result fills the select with: the nearest shown year at or below it. */
export function yearIdFromLevel(level: number | null, shownNow: readonly { id: YearId }[] = shownYears()): YearId | undefined {
  if (level === null) return undefined;
  const shown = new Set(shownNow.map(y => y.id));
  for (let i = Math.min(level, LEVELS.length - 1); i >= 0; i--) if (shown.has(LEVELS[i])) return LEVELS[i];
  return undefined;
}

/** A brand-new child: no school year yet and no topic progress, so the map asks once. */
export const needsSchoolYear = (d: { ks2: { schoolYear?: YearId }; progress: object }): boolean =>
  !d.ks2.schoolYear && Object.keys(d.progress ?? {}).length === 0;

// #1288: a KS1 island reached by a child already in KS2 reads "Warm-up", not an age band older children reject.
// Pure: the caller passes the stored school year (`ks2.schoolYear`, #1055), never `SaveData.year`.
import { isKs2 } from '../curriculum/key-stage';
import type { YearId } from '../curriculum/types';

export const WARM_UP = 'Warm-up';
/** True when `year` is a KS1/EYFS island and the child's school year is KS2. */
export const isWarmUp = (year: { id: YearId }, schoolYear?: YearId): boolean => !!schoolYear && !isKs2(year.id) && isKs2(schoolYear);
export const ageLabel = (year: { id: YearId; age: string }, schoolYear?: YearId): string => isWarmUp(year, schoolYear) ? WARM_UP : year.age;

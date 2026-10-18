import type { Topic, YearInfo } from '../src/curriculum/types';

export interface StrandRow { id: string; subject: 'maths' | 'writing'; years: string[]; source: string; name: string; re: string; not?: string }
export interface StrandTable { sources: Record<string, string>; shared: { pos: string }; strands: StrandRow[] }
/** Strand rows whose year, subject and patterns take this topic. */
export declare function strandsOf(topic: Pick<Topic, 'subject' | 'year' | 'nc'>, table: StrandTable): StrandRow[];
/** Topic ids a `docs/CURRICULUM.md` names as a row. */
export declare function curriculumIds(md: string): string[];
export declare function buildContentMap(input: {
  topics: Topic[]; years: YearInfo[]; strands: StrandTable; tipFor: (id: string) => string | null; banks?: Record<string, number>;
}): { json: string; md: string };

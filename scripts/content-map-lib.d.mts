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
/** The topics and years a catalogue shows (#2201): what the website may publish. `shown` is `src/curriculum/catalogue-shown.ts`. */
export declare function publishedOnly(input: {
  topics: Topic[]; years: YearInfo[]; catalogue: unknown;
  shown: { gameOn: (cat: never, id: string, year: never) => boolean; islandShown: (cat: never, year: never, topics: never) => boolean };
}): { topics: Topic[]; years: YearInfo[] };

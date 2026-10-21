import type { Topic, YearId } from '../src/curriculum/types';

type Subject = Topic['subject'];
export interface ContentMapTopic { title: string; year: YearId; subject: Subject; nc: string; strands: string[] }
export interface ContentMapYear { year: YearId; title: string; maths: number; writing: number }
export interface ContentMapStrand { id: string; name: string; subject: Subject; years: YearId[]; topics: string[] }
/**
 * The fields of docs/content-map.json that this page reads, written out by hand: `scripts/content-map-lib.mjs`
 * returns the file as a string, and the rail in `tests/unit/site-curriculum.test.ts` is what ties the two.
 */
export interface ContentMap { topicCount: number; byYear: ContentMapYear[]; topics: ContentMapTopic[]; coverage: ContentMapStrand[] }
export declare function esc(s: unknown): string;
export declare function yearSlug(id: YearId): string;
export declare function shellFrom(home: string, currentPath: string): { header: string; footer: string };
export declare function subjectTable(map: ContentMap, year: ContentMapYear, subject: Subject): string;
export declare function gapsOf(map: ContentMap, year: ContentMapYear): ContentMapStrand[];
export declare function renderYear(map: ContentMap, year: ContentMapYear): string;
export declare function renderCurriculumPage(map: ContentMap, home: string): string;

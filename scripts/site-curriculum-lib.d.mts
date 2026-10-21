export interface ContentMapTopic { id: string; title: string; year: string; subject: 'maths' | 'writing'; nc: string; tip: string | null; strands: string[] }
export interface ContentMapYear { year: string; title: string; maths: number; writing: number }
export interface ContentMapStrand { id: string; name: string; subject: 'maths' | 'writing'; years: string[]; source: string; topics: string[] }
/** The parts of docs/content-map.json this page reads. */
export interface ContentMap { topicCount: number; byYear: ContentMapYear[]; topics: ContentMapTopic[]; coverage: ContentMapStrand[] }
export declare function esc(s: unknown): string;
export declare function yearSlug(id: string): string;
export declare function shellFrom(home: string, currentPath: string): { header: string; footer: string };
export declare function subjectTable(map: ContentMap, year: ContentMapYear, subject: 'maths' | 'writing', label: string): string;
export declare function gapsOf(map: ContentMap, year: ContentMapYear): ContentMapStrand[];
export declare function renderYear(map: ContentMap, year: ContentMapYear): string;
export declare function renderCurriculumPage(map: ContentMap, home: string): string;

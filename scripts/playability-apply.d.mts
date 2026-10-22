import type { Catalogue } from '../src/config/catalogue';
import type { PlaytestRow, RowContext } from './playtest-row.mjs';

export interface Report { path: string; text: string }
export type Parsed = { row: unknown; where: string };
export declare const CATALOGUE_FILE: string;
export declare const isDate: (v: string) => boolean;
export declare const reportPath: (date: string, profile: string) => string;
export declare function parseRows(text: string, file: string): { rows: Parsed[]; problems: string[] };
export declare function checkRows(parsed: Parsed[], ctx: RowContext): string[];
export declare function renderReport(profile: string, date: string, rows: PlaytestRow[], chosen: PlaytestRow[]): string;
/** Precondition: `rows` passed `checkRows` with no problem; they are not re-checked. */
export declare function applyRows<C extends RowContext['catalogue']>(catalogue: C, rows: PlaytestRow[], date: string): { catalogue: C; reports: Report[]; written: number };
export declare function reportProblems(catalogue: Pick<Catalogue, 'years' | 'games'>, read: (path: string) => string | null): string[];
export declare function main(argv: string[], log?: (s: string) => void, warn?: (s: string) => void): number;

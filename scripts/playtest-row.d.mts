export type Criterion = 'understand' | 'physical' | 'challenge' | 'feedback' | 'again';
export interface Evidence { criterion: Criterion; ref: string; saw: string }
/** One playtest row, as `.claude/skills/playtest/SKILL.md` §4 defines it. */
export interface PlaytestRow { game: string; year: string; by: string; score: number; criteria: Record<Criterion, number>; evidence: Evidence[]; note: string }
/** What a row is checked against: the parsed catalogue (its `groups` and `games`) and the profile names on disk. */
export interface RowContext { catalogue: { groups: Record<string, readonly string[]>; games: Record<string, { years: object }> }; profiles: readonly string[] }
export declare const CRITERIA: readonly Criterion[];
export declare const ROW_KEYS: readonly (keyof PlaytestRow)[];
export declare const PARENT: 'playtester-parent';
export declare function profilesIn(dir: string): string[];
export declare function rowProblems(row: unknown, ctx: RowContext): string[];

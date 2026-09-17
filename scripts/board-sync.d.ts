export declare const STATUS: Readonly<{
  DONE: 'Done'; OWNER: 'Owner action'; REVIEW: 'In review'; PROGRESS: 'In progress';
  BLOCKED: 'Blocked'; READY: 'Ready'; BACKLOG: 'Backlog';
}>;
export declare const PRIORITIES: string[];
export interface Pr { number: number; title: string; body: string; labels: string[]; draft?: boolean }
export interface Repo { prs: Pr[]; branches: string[] }
export interface IssueLike { number: number; state: 'open' | 'closed'; title?: string; labels: string[]; nodeId?: string }
export interface Content extends Partial<IssueLike> { kind: 'Issue' | 'PullRequest' | 'Draft' }
export interface Item { id: string; isArchived: boolean; content: Content | null; status: string | null; priority: string | null }
export interface Change {
  kind: 'add' | 'archive' | 'status' | 'priority'; number?: number; itemId?: string; nodeId?: string;
  from?: string | null; to?: string | null; priority?: string | null;
}
export declare function linkedIssues(pr: Partial<Pr>): number[];
export declare function branchIssue(name: string): number | null;
export declare function isNonWork(issue: Partial<IssueLike>): boolean;
export declare function desiredStatus(issue: IssueLike, repo: Repo): string;
export declare function desiredPriority(labels: string[]): string | null;
export declare function plan(input: { items: Item[]; openIssues: IssueLike[]; repo: Repo }): Change[];
export declare function summary(changes: Change[], cards: number, dryRun: boolean, limit?: number): string;
export interface HeartbeatIssue { number: number; created_at: string; title: string; pull_request?: object }
export declare function pickHeartbeat(open: HeartbeatIssue[]): HeartbeatIssue[];
export declare const PULSE: Readonly<{ title: string; labels: string[] }>;
export declare const PULSE_REFRESH_MS: number;
export declare function pulseTime(body: string | null | undefined): Date | null;
export declare function pulseNeeded(existingBody: string | null | undefined, now: Date, changes: Change[]): boolean;
export declare function pulseLine(now: Date, line: string): string;
export declare function resolveProjectToken(env?: Record<string, string | undefined>, root?: string): string;
export declare function main(argv?: string[], env?: Record<string, string | undefined>): Promise<string>;

type Labelled = { number: number; title?: string; body?: string | null; labels?: (string | { name?: string })[]; pull_request?: unknown };
type Pr = { title?: string; body?: string | null; head?: { ref?: string } };
export declare const REPO: string;
export declare const CREATOR: string;
export declare const DROP_LABELS: string[];
export declare const HELD_LABELS: string[];
export declare function blockedBy(body: string | null | undefined): { numbers: number[]; foreign: boolean };
export declare function prSolves(pr: Pr, n: number): boolean;
export declare function pickIssue(input: { candidates: Labelled[]; prs: Pr[]; open: Set<number> }): {
  ranked: Labelled[];
  dropped: { label: number[]; held: number[]; heartbeat: number[]; openPr: number[]; blocked: number[] };
  blockersRead: number;
};
export declare function report(result: ReturnType<typeof pickIssue>, total: number): string;

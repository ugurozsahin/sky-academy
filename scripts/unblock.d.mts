export declare function blockersOf(body: string | null | undefined): number[] | null;
export declare function staleBlocked(
  open: { number: number; body?: string | null; labels?: (string | { name?: string })[]; pull_request?: unknown }[],
  closedNow?: number | null,
): number[];

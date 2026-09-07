export declare const isChangesRequested: (body: string) => boolean;
export declare const isCleared: (body: string) => boolean;
export declare function blockState(pr: { draft: boolean; comments: { body: string; created_at: string }[] }):
  { blocked: boolean; reasons: string[] };

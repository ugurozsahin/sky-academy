export declare const isChangesRequested: (body: string) => boolean;
export declare const isCleared: (body: string) => boolean;
export declare const hasSessionUrl: (body: string) => boolean;
export declare const isAdoptionClear: (body: string) => boolean;
export declare function blockState(pr: { draft: boolean; labels?: string[]; comments: { body: string; created_at: string; author_association?: string }[] }):
  { blocked: boolean; reasons: string[] };

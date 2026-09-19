/** GitHub's own enum for a comment author's relationship to the repo (#254: now actually checked). */
export type AuthorAssociation =
  'OWNER' | 'MEMBER' | 'COLLABORATOR' | 'CONTRIBUTOR' | 'FIRST_TIME_CONTRIBUTOR' | 'FIRST_TIMER' | 'NONE' | 'MANNEQUIN';
export declare const isChangesRequested: (body: string) => boolean;
export declare const isCleared: (body: string) => boolean;
export declare const isOwnerRejected: (body: string) => boolean;
export declare const isOwnerApproved: (body: string) => boolean;
export declare const hasSessionUrl: (body: string) => boolean;
export declare const isAdoptionClear: (body: string) => boolean;
export declare function blockState(pr: { draft: boolean; labels?: string[]; comments: { body: string; created_at: string; author_association?: AuthorAssociation }[] }):
  { blocked: boolean; reasons: string[] };
export declare const CLOSING_KEYWORDS: string[];
export declare function closingRefs(body: string): number[];

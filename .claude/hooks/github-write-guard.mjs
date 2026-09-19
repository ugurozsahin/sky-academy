import { deny, isMain, readInput } from './io.mjs';

/**
 * Layer-0 guard for the MCP GitHub tools that post an authored body or labels (#101). Each check returns a
 * reason to deny, or null. Why each rule exists is in `.claude/rules/governance.md`.
 */

const ROUTINE_HEARTBEAT = 62;

// A body that OPENS with an owner marker, the same shape `scripts/review-gate.mjs` reads as a verdict:
// APPROVED strictly, REJECTED with emphasis and case forgiven. Characters GitHub renders as nothing are
// deleted first, so none of them can hide inside the marker. The set is a UNION on purpose (#221): swapping
// Cf/Cc for Default_Ignorable_Code_Point once dropped real format characters. Add to it, never replace.
const INVISIBLE = /[\p{Cf}\p{Cc}\p{Default_Ignorable_Code_Point}\u3164\ufe0f]+/gu;
const norm = (s) => s.replace(INVISIBLE, '').replace(/\s+/g, ' ').trim();

export const ownerMarker = ({ body }) => {
  if (typeof body !== 'string') return null;
  const strict = norm(body), loose = norm(body.replace(/[*_`>#]/g, '')).toUpperCase();
  return /^OWNER: ?APPROVED/.test(strict) || /^OWNER: ?REJECTED/.test(loose)
    ? 'No agent ever writes an OWNER: APPROVED / OWNER: REJECTED marker (CLAUDE.md, #101 layer 0) - only the human owner writes these, in the GitHub UI. This body opens with one.'
    : null;
};

const updatesHeartbeat = ({ method, issue_number }) => method === 'update' && Number(issue_number) === ROUTINE_HEARTBEAT;

export const secondItem = (input) => updatesHeartbeat(input) && !/(^|\n)- second item: /.test(input.body ?? '')
  ? 'The routine heartbeat (issue #62) must carry a - second item: line naming whether a second item was taken and, if not, which of the four #97 conditions failed. This update body is missing it.'
  : null;

const SUMMARY_LINE = /(^|\n)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?Z — /g;

export const heartbeatAppend = (input) => updatesHeartbeat(input) && ((input.body ?? '').match(SUMMARY_LINE) ?? []).length > 1
  ? 'The routine heartbeat (issue #62) is overwritten each run, never appended to (#98): this body carries two or more UTC-timestamp summary lines, the signature of a new summary tacked onto the old one.'
  : null;

export const frozenLabel = ({ labels }) => Array.isArray(labels) && labels.includes('frozen')
  ? 'The frozen label is retired (.claude/rules/governance.md, #101 layer 0): the freeze the owner lifted on 2026-09-10 does not re-arm, and no run applies this label to reinstate it.'
  : null;

export const check = (input) =>
  ownerMarker(input) ?? secondItem(input) ?? frozenLabel(input) ?? heartbeatAppend(input);

if (isMain(import.meta.url)) {
  const reason = check(await readInput());
  if (reason) deny(reason);
}

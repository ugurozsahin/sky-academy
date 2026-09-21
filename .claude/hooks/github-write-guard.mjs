import { deny, isMain, readInput } from './io.mjs';
import { projectDir, protectedKind } from './paths.mjs';

/**
 * Layer-0 guard for the MCP GitHub tools that post an authored body or labels (#101). Each check returns a
 * reason to deny, or null. Why each rule exists is in `.claude/rules/governance.md`.
 *
 * Every rule this module exports is reached from `check` below, which is the only thing `.claude/settings.json`
 * calls — a rule written and not wired in denies nothing, and the suite used to stay green when one was
 * unwired. `tests/unit/hooks.test.ts` holds that for every export, not for a list of names (#359).
 */

const ROUTINE_HEARTBEAT = 62;
const HEARTBEAT_TITLE = 'routine: heartbeat';

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

const REVIEWER_HEARTBEAT_TITLE = 'reviewer: heartbeat';

/**
 * Which pulse a write is about, or null. **Two routines, two pulses** (#327): the reviewer got one of its own
 * because it was the only moving part nothing watched, and the two are deliberately not one issue — one body
 * with two writers, and the developer's `- second item:` shape does not fit a routine that has no second item.
 *
 * So the record disciplines are split: `heartbeatAppend` applies to **both**, because replace-never-append is
 * the same rule for any pulse; `requiredLines` applies to the developer's alone, via `heartbeatWrite` below.
 *
 * **Identity, and how much of it is enforced — which differs between the two pulses.** Every prompt names a
 * pulse by **title**: STEP 5 of `docs/ROUTINE-PROMPT.md` and STEP 1 of `docs/REVIEWER-PROMPT.md` both say to
 * replace the body of the issue titled `<name>: heartbeat`, and to create it if it does not exist;
 * `docs/WATCHDOG-PROMPT.md` reads both by title. This hook used to match by number alone, so a pulse closed
 * and recreated — which the prompts tell a run to do — came back with a new number and escaped every rule
 * below, permanently and silently, with the whole suite green (#353). Matching the title fixed that, and
 * closed the `create` exemption in the same expression.
 *
 * But an `update` sends no title unless it is *changing* one, so a title-less body replacement is a write
 * this hook cannot recognise, and it cannot learn the number from one call.
 *
 *   - For the **developer** pulse that is a post-recreate corner: `ROUTINE_HEARTBEAT` catches every ordinary
 *     write, and only a recreated issue's title-less updates escape.
 *   - For the **reviewer** pulse the title is the *whole* of the enforcement. There is no number to fall back
 *     to — the issue does not exist until a run creates it, so no constant here could name it — and the
 *     title-less update is the ordinary shape, not an edge case (PR #417 review, B2). What holds it shut is
 *     one clause of prose, STEP 1's "send its title with every write", and that clause is therefore pinned by
 *     `tests/unit/governance.test.ts` as load-bearing rather than left to survive the next byte squeeze.
 *
 * The title is compared **normalised**: it is typed by a run out of prose, and `Routine: Heartbeat`, a
 * trailing space invisible in the GitHub UI, or `routine: heartbeat (run log)` would each otherwise read as a
 * different issue. `method` is required, and its absence is not a pulse: a call with no `method` is not an
 * `issue_write` at all but one of the comment tools this hook also matches, and gating an ordinary comment on
 * #62 behind the pulse's body rules would be wrong.
 */
const pulseWrite = ({ method, issue_number, title }) => {
  if (method !== 'create' && method !== 'update') return null;
  const named = typeof title === 'string' ? norm(title).toLowerCase() : '';
  for (const pulse of [HEARTBEAT_TITLE, REVIEWER_HEARTBEAT_TITLE]) if (named.startsWith(pulse)) return pulse;
  return Number(issue_number) === ROUTINE_HEARTBEAT ? HEARTBEAT_TITLE : null;
};

const heartbeatWrite = (input) => pulseWrite(input) === HEARTBEAT_TITLE;

/**
 * The heartbeat's body text, or null when this call is not about the heartbeat or carries no body at all.
 *
 * `body` is optional on `issue_write`, so a labels-only, title-only or state-only update carries none — and
 * denying *that* for a missing line names a body the run never sent, whose obvious remedy is to add one, which
 * overwrites the pulse these rules exist to protect. A non-string body is the same defect from the other side:
 * `.match` on it throws, and a `PreToolUse` hook that throws exits non-zero with empty stdout, which is a
 * non-blocking hook error — so the write proceeds. That was unreachable only by the accident that a sibling
 * rule denied first. `heartbeatAppend` reads its own body — it spans both pulses and this helper does not —
 * so the same two guards are written out there; `check` wraps the lot in a `try` as well, which is what
 * stops either failure coming back one rule at a time (#359).
 */
const heartbeatBody = (input) => (heartbeatWrite(input) && typeof input.body === 'string' ? input.body : null);

/**
 * The lines STEP 1's stamp and STEP 5's snapshot must both carry. One array rather than two copied rules: the
 * `: *\S` hole had to be closed twice in #341 *because* they were copies, and `.claude/rules/governance.md`
 * already anticipates a third line. `tests/unit/hooks.test.ts` reads this array rather than restating it.
 */
export const REQUIRED_LINES = Object.freeze([
  Object.freeze({ key: '- second item:',
    why: 'whether a second item was taken and, if not, which of the four #97 conditions failed' }),
  Object.freeze({ key: '- query top pick:',
    why: "the issue STEP 3's query returned and, when the run developed a different one, which of the three "
      + 'documented ways past the order it used (#338)' }),
]);

// The value is as load-bearing as the heading — a bare `- second item:` is what a half-written stamp produces
// and would otherwise pass — and the line anchor is what makes it a record: a line a reader can find, not a
// phrase inside a sentence. The key is escaped at the boundary that depends on it rather than trusted to stay
// metacharacter-free, which was a rule in the test file guarding a decision made here (PR #393 review).
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const carries = (body, key) => new RegExp(`(^|\\n)${escapeRe(key)} *\\S`).test(body);

export const requiredLines = (input) => {
  const body = heartbeatBody(input);
  if (body === null) return null;
  const missing = REQUIRED_LINES.filter(({ key }) => !carries(body, key));
  if (missing.length === 0) return null;
  // One deny naming every missing line, never one per call. Since #338 a body missing both is the ordinary
  // case, and a `??` chain would deny, be half-fixed, and deny again — two round trips at STEP 1, and at
  // STEP 5 a denied write leaves the pulse reading IN PROGRESS, which the watchdog reads as a dead run (#359).
  return `The routine heartbeat (the issue titled "${HEARTBEAT_TITLE}", #${ROUTINE_HEARTBEAT}) must carry `
    + `${missing.map(({ key, why }) => `a \`${key} \` line naming ${why}`).join('; and ')}. `
    + `This body is missing ${missing.length > 1 ? 'both' : 'it'}. Each line starts a line of its own and `
    + 'carries a value, not just the heading.';
};

const SUMMARY_LINE = /(^|\n)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?Z — /g;

export const heartbeatAppend = (input) => {
  const pulse = pulseWrite(input);
  const body = pulse !== null && typeof input?.body === 'string' ? input.body : null;
  return body !== null && (body.match(SUMMARY_LINE) ?? []).length > 1
    ? `A run pulse (the issue titled "${pulse}") is overwritten each run, never appended to (#98): this body carries two or more UTC-timestamp summary lines, the signature of a new summary tacked onto the old one.`
    : null;
};

export const frozenLabel = ({ labels }) => Array.isArray(labels) && labels.includes('frozen')
  ? 'The frozen label is retired (.claude/rules/governance.md, #101 layer 0): the freeze the owner lifted on 2026-09-10 does not re-arm, and no run applies this label to reinstate it.'
  : null;

/**
 * The third route a write to `.claude/` can take, and the only one that lands on the remote (#346 covered the
 * shell, #342 the file tools). `mcp__github__create_or_update_file`, `push_files` and `delete_file` take a
 * repository path and commit it straight to a branch, so a run refused locally could have pushed the same
 * edit — worse, because it is already on GitHub (PR #393 review, B5b). The path is repo-relative, which is
 * exactly what `protectedKind()` judges, so this asks the same question the other two guards ask.
 */
export const filePath = (input, root) => {
  const named = [input?.path, ...(Array.isArray(input?.files) ? input.files.map((f) => f?.path) : [])];
  const base = projectDir(root);
  const hit = named.find((p) => typeof p === 'string' && protectedKind(p, base) !== null);
  return hit
    ? `${hit} is a protected path (#342/#346), and committing it through an MCP file write is not a way round `
      + 'the Write, Edit and Bash guards — it is the same edit, landing on the remote instead of the working '
      + 'copy. Say on the issue what needed changing here and why, label it `owner-session`, and take the next '
      + 'item — .claude/rules/governance.md has the rule.'
    : null;
};

// Every entry point of every guard here turns a throw into a deny, for the reason `bash-guard.mjs` gives: a
// PreToolUse hook that throws exits non-zero with empty stdout, which is a non-blocking error and the write
// proceeds. `heartbeatBody` fixed one expression; this fixes the class (PR #393 review, note 7).
export const check = (input, root) => {
  try {
    return ownerMarker(input ?? {}) ?? requiredLines(input ?? {}) ?? filePath(input, root)
      ?? frozenLabel(input ?? {}) ?? heartbeatAppend(input ?? {});
  } catch {
    return 'github-write-guard could not decide about this call (#101), so it refused. Re-send it in the '
      + 'shape the tool documents, or say on the issue what you were trying to record.';
  }
};

if (isMain(import.meta.url)) {
  const reason = check(await readInput());
  if (reason) deny(reason);
}

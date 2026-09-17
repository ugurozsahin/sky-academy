// Keeps the "Sky Academy" project board (GitHub Projects v2) in step with the repository (#158).
//
// The board is a PROJECTION of state the repository already carries — an issue's open/closed state, its
// labels, the open pull requests and the branches — and never a second thing to maintain by hand. This
// script reads that state, derives what every card's Status and Priority should be, and writes only the
// differences: a quiet run reads four or five API pages and writes nothing. It never writes a label, never
// closes an issue, never touches a pull request — the arrows point one way, repo → board, so nothing is
// ever edited in two places. The owner steers by changing an issue's `priority:*` label (from the issue or
// from the board's Priority field, which GitHub maps back to the label); the routine reads labels, not the
// board (docs/ROUTINE-PROMPT.md STEP 3).
//
// The rule, first match wins — this comment is the one place the table lives; the docs point here:
//
//   issue closed                                              → Done
//   open PR linked, and `owner-approval` on the PR or issue   → Owner action
//   open PR linked                                            → In review
//   a branch named for the issue, and no PR yet (#160)        → In progress
//   `owner-input` or `owner-approval` on the issue            → Owner action
//   `blocked`                                                 → Blocked
//   `later`                                                   → Backlog
//   `priority:P0` or `priority:P1`                            → Ready
//   otherwise                                                 → Backlog
//
// Priority mirrors the `priority:*` label exactly, and is cleared when the issue has none.
// Cards that are not work — the two heartbeat issues and the retired pinned priority-order issue — are
// archived rather than given a misleading Status. A pull-request card is Done when closed, else In review.
// Open issues missing from the board are added, so the board is the whole open backlog, not the part that
// happened to be added by hand.
//
// WHERE IT RUNS, and why not in the routine. Projects v2 exists only in GitHub's GraphQL API, and Anthropic's
// cloud sessions reach GitHub through a proxy that serves a pinned set of pull-request GraphQL operations and
// answers everything else with 403 — "regardless of the credentials you supply", per the Claude Code docs
// (code.claude.com/docs/en/cloud-environments, "GitHub proxy"), which name Projects v2 as the example. So the
// dev routine and the watchdog can never run this, with any token. It runs on the owner's Mac instead, every
// 15 minutes, as a launchd agent (`scripts/board-sync.plist`; install steps in its comment), reading the
// board token from `.git/github-project-token` — a CLASSIC personal access token with `project` + `repo`
// scope (a fine-grained token cannot reach a user-owned project). `GITHUB_PROJECT_TOKEN` in the environment
// wins when set. Neither present → exit 2 with a loud message: a silently skipped sync looks exactly like a
// board with nothing to change.
//
// THE PULSE, so the cloud agents can still tell a synced board from a dead sync. A real run (not `--dry-run`)
// ends by writing one line into the body of the open issue titled `board: heartbeat` (label `watchdog`):
// `<UTC timestamp> — <the summary line>`. It is written when something changed, or when the existing pulse
// is more than an hour old — so a quiet board still gets a fresh pulse every hour, without 96 issue edits a
// day. The routine reads it in STEP 1 and the watchdog in check 8: a pulse older than ~2 hours means the Mac
// job is not running, and an open issue with no timestamp is stale, never a pass. Created with title, body
// and label in one POST if absent, never create-then-fill; never closed. That is the only thing this script
// writes to the repository — it never writes a label, an issue state or a pull request.
//
// Usage:  node scripts/board-sync.mjs [--dry-run] [--all]   prints one `board: …` line
//         (`--dry-run` neither touches the board nor writes the pulse; `--all` lists every change).
// The pure parts (`desiredStatus`, `desiredPriority`, `linkedIssues`, `branchIssue`, `isNonWork`, `plan`,
// `pulseNeeded`) are exported and held by tests/unit/board-sync.test.ts; the network shell is at the end.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closingRefs } from './review-gate.mjs';

export const OWNER = 'ugurozsahin';
export const REPO = 'sky-academy';
export const PROJECT_NUMBER = 1;

export const STATUS = Object.freeze({
  DONE: 'Done',
  OWNER: 'Owner action',
  REVIEW: 'In review',
  PROGRESS: 'In progress',
  BLOCKED: 'Blocked',
  READY: 'Ready',
  BACKLOG: 'Backlog',
});
export const PRIORITIES = ['P0', 'P1', 'P2', 'P3'];

const has = (labels, name) => (labels || []).includes(name);

/** The issue numbers a pull request is solving: `(#n)` in the title, `Closes #n` / `Part of #n` in the body. */
export function linkedIssues(pr) {
  const out = new Set(closingRefs(pr.body || ''));
  for (const m of (pr.title || '').matchAll(/\(#(\d+)\)/g)) out.add(Number(m[1]));
  for (const m of (pr.body || '').matchAll(/\bpart of\s+(?:[\w.-]+\/[\w.-]+)?#(\d+)/gi)) out.add(Number(m[1]));
  return [...out].sort((a, b) => a - b);
}

/** The issue a branch is named for (#160: `feature|fix|chore/<n>-<slug>`; the retired `claude/issue-<n>` too). */
export function branchIssue(name) {
  const m = /^(?:feature|fix|chore)\/(\d+)-/.exec(name || '') || /^claude\/issue-(\d+)$/.exec(name || '');
  return m ? Number(m[1]) : null;
}

/** Cards that are not work: the two pulses, and the retired hand-ordered list. */
export function isNonWork(issue) {
  const title = (issue.title || '').trim();
  if (has(issue.labels, 'watchdog') && /\bheartbeat$/i.test(title)) return true;
  return /^📌 Priority order/.test(title);
}

/**
 * @param {{state:'open'|'closed', labels:string[], number:number}} issue
 * @param {{prs: {number:number, title:string, body:string, labels:string[], draft?:boolean}[], branches: string[]}} repo
 *        `prs` are the OPEN pull requests only; `branches` every branch name on origin.
 */
export function desiredStatus(issue, repo) {
  if (issue.state !== 'open') return STATUS.DONE;
  const labels = issue.labels || [];
  const pr = (repo.prs || []).find((p) => linkedIssues(p).includes(issue.number));
  if (pr) return has(pr.labels, 'owner-approval') || has(labels, 'owner-approval') ? STATUS.OWNER : STATUS.REVIEW;
  if ((repo.branches || []).some((b) => branchIssue(b) === issue.number)) return STATUS.PROGRESS;
  if (has(labels, 'owner-input') || has(labels, 'owner-approval')) return STATUS.OWNER;
  if (has(labels, 'blocked')) return STATUS.BLOCKED;
  if (has(labels, 'later')) return STATUS.BACKLOG;
  if (has(labels, 'priority:P0') || has(labels, 'priority:P1')) return STATUS.READY;
  return STATUS.BACKLOG;
}

/** The `priority:*` label as the board's Priority option, or null to clear the field. */
export function desiredPriority(labels) {
  const found = PRIORITIES.filter((p) => has(labels, `priority:${p}`));
  return found.length ? found[0] : null;     // two labels is a mistake on the issue; mirror the highest
}

/**
 * The changes that bring the board in line. Pure, so the same input always yields the same plan and a
 * board that already matches yields `[]` — that is what "idempotent" means here, and the test holds it.
 *
 * @param {object} input
 * @param {{id:string, isArchived:boolean, content:null|{kind:'Issue'|'PullRequest'|'Draft', number?:number,
 *          state?:'open'|'closed', title?:string, labels?:string[], nodeId?:string}, status:string|null,
 *          priority:string|null}[]} input.items   the board's cards
 * @param {{number:number, state:'open'|'closed', title:string, labels:string[], nodeId:string}[]} input.openIssues
 *          every OPEN issue in the repository (to find the ones missing from the board)
 * @param {{prs:object[], branches:string[]}} input.repo
 * @returns {{kind:'add'|'archive'|'status'|'priority', number?:number, itemId?:string, nodeId?:string,
 *            from?:string|null, to?:string|null}[]}
 */
export function plan({ items, openIssues, repo }) {
  const changes = [];
  const onBoard = new Set();
  for (const item of items) {
    if (!item.content) continue;
    const c = item.content;
    // An archived card counts as on the board: an issue the owner archived by hand must not come back every
    // fifteen minutes (the first review caught exactly that), and the pulses stay archived once archived.
    if (c.kind === 'Issue') onBoard.add(c.number);
    if (item.isArchived) continue;
    if (c.kind === 'Draft') continue;                      // a draft card is a note; nothing to derive
    if (c.kind === 'Issue' && isNonWork(c)) {
      changes.push({ kind: 'archive', number: c.number, itemId: item.id });
      continue;
    }
    const status = c.kind === 'Issue'
      ? desiredStatus(c, repo)
      : (c.state === 'open' ? STATUS.REVIEW : STATUS.DONE);
    if (item.status !== status) changes.push({ kind: 'status', number: c.number, itemId: item.id, from: item.status, to: status });
    if (c.kind === 'Issue') {
      const priority = desiredPriority(c.labels);
      if ((item.priority || null) !== priority) {
        changes.push({ kind: 'priority', number: c.number, itemId: item.id, from: item.priority || null, to: priority });
      }
    }
  }
  for (const issue of openIssues || []) {
    if (onBoard.has(issue.number) || isNonWork(issue)) continue;
    changes.push({ kind: 'add', number: issue.number, nodeId: issue.nodeId,
      to: desiredStatus(issue, repo), priority: desiredPriority(issue.labels) });
  }
  return changes;
}

/** One line for the heartbeat: what happened, with the numbers, never a bare verdict. */
export function summary(changes, cards, dryRun, limit = 8) {
  const verb = dryRun ? 'would change' : 'synced';
  if (!changes.length) return `board: in step — 0 changes, ${cards} cards`;
  const shown = changes.slice(0, limit).map((ch) => {
    if (ch.kind === 'add') return `#${ch.number} added → ${ch.to}`;
    if (ch.kind === 'archive') return `#${ch.number} archived`;
    return `#${ch.number} ${ch.kind} ${ch.from ?? '—'} → ${ch.to ?? '—'}`;
  });
  const more = changes.length > limit ? ` (+${changes.length - limit} more)` : '';
  return `board: ${verb} ${changes.length}: ${shown.join(', ')}${more}`;
}

export const PULSE = Object.freeze({ title: 'board: heartbeat', labels: ['watchdog'] });
export const PULSE_REFRESH_MS = 60 * 60 * 1000;

/** The UTC timestamp a pulse body starts with, as a Date, or null when there is none to parse. */
export function pulseTime(body) {
  const m = /^\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?Z)/.exec(body || '');
  return m ? new Date(m[1]) : null;
}

/**
 * Whether this run rewrites the pulse: yes when something changed, yes when the existing pulse is unreadable
 * (an empty body is a dead pulse, not a fresh one), yes when it is older than an hour — otherwise no, so a
 * quiet board costs one issue edit an hour rather than one every fifteen minutes.
 */
export function pulseNeeded(existingBody, now, changes) {
  if (changes.length) return true;
  const at = pulseTime(existingBody);
  return !at || now.getTime() - at.getTime() >= PULSE_REFRESH_MS;
}

export const pulseLine = (now, line) => `${now.toISOString().slice(0, 16)}Z — ${line}`;

/** The project token, or a thrown Error whose message says exactly where it was looked for. */
export function resolveProjectToken(env = process.env, root = repoRoot()) {
  if (env.GITHUB_PROJECT_TOKEN) return env.GITHUB_PROJECT_TOKEN.trim();
  const file = resolve(root, '.git/github-project-token');
  if (existsSync(file)) return readFileSync(file, 'utf8').trim();
  throw new Error(
    'board: NOT synced — no project token. Projects v2 needs a classic PAT with `project` scope: set ' +
    '`GITHUB_PROJECT_TOKEN` in the environment (the cloud routine) or put it in `.git/github-project-token` ' +
    '(the owner\'s Mac). A fine-grained token and the routine\'s own `GITHUB_TOKEN` cannot reach the board.',
  );
}

const repoRoot = () => resolve(fileURLToPath(import.meta.url), '../..');

// ---- the network shell ---------------------------------------------------------------------------------

const api = async (token, path) => {
  const out = [];
  let url = `https://api.github.com/repos/${OWNER}/${REPO}${path}${path.includes('?') ? '&' : '?'}per_page=100`;
  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${(await res.text()).slice(0, 200)}`);
    out.push(...(await res.json()));
    url = /<([^>]+)>;\s*rel="next"/.exec(res.headers.get('link') || '')?.[1] || null;
  }
  return out;
};

// The one REST write this script makes is the pulse (create once, then edit the body). A guard rail counts
// the call sites of this helper, so a new write here is a visible act, not a drift.
const restWrite = async (token, method, path, payload) => {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
};

/**
 * Among open issues carrying the pulse label, the ones actually titled `board: heartbeat` (never a pull
 * request, which can carry the same label for other reasons). #125: a duplicate can exist — two runs have
 * raced the create path within the same window before now — and `Array.prototype.find` on an unsorted API
 * response then picks whichever the API happens to list first, which silently moves the pulse's identity
 * to a different issue number between runs. A reader who bookmarked the old number sees it go stale and
 * wrongly reports the sync as dead. Sorting by `created_at` fixes the identity to the OLDEST candidate —
 * the one every prompt has already been reading — so an accidental new duplicate never steals the pulse
 * out from under whoever already knows the real one's number.
 * @param {{number:number, created_at:string, title:string, pull_request?:object}[]} open
 * @returns {{number:number, created_at:string, title:string, pull_request?:object}[]}
 */
export function pickHeartbeat(open) {
  const candidates = open
    .filter((i) => !i.pull_request && i.title === PULSE.title)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  return candidates;
}

async function writePulse(token, line, changes, now = new Date()) {
  const open = await api(token, `/issues?state=open&labels=${PULSE.labels[0]}`);
  const candidates = pickHeartbeat(open);
  const existing = candidates[0] || null;
  if (existing && !pulseNeeded(existing.body, now, changes)) return 'pulse kept';
  // #125: surface a duplicate rather than silently resolving it — closing an issue is not this script's
  // job (CLAUDE.md: "the sync never writes a label, closes an issue or touches a PR"), but a reader of the
  // pulse should not have to discover a stale twin by accident.
  const dupeNote = candidates.length > 1
    ? ` [${candidates.length} open '${PULSE.title}' issues found (#125) — writing to the oldest, #${existing.number}; the rest are stale duplicates, close them by hand]`
    : '';
  const body = pulseLine(now, line + dupeNote);
  if (existing) await restWrite(token, 'PATCH', `/issues/${existing.number}`, { body });
  else await restWrite(token, 'POST', '/issues', { title: PULSE.title, body, labels: PULSE.labels });
  return existing ? 'pulse written' : 'pulse created';
}

const graphql = async (token, query, variables) => {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error(`GraphQL → ${res.status} ${JSON.stringify(json.errors || json).slice(0, 300)}`);
  return json.data;
};

const ITEMS_QUERY = `query($owner:String!, $number:Int!, $after:String) {
  user(login:$owner) { projectV2(number:$number) {
    id
    fields(first:30) { nodes { ... on ProjectV2SingleSelectField { id name options { id name } } } }
    items(first:100, after:$after) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id isArchived
        fieldValues(first:12) { nodes { ... on ProjectV2ItemFieldSingleSelectValue { name field { ... on ProjectV2FieldCommon { name } } } } }
        content {
          __typename
          ... on Issue { number state title labels(first:20) { nodes { name } } }
          ... on PullRequest { number state title }
          ... on DraftIssue { title }
        }
      }
    }
  } }
}`;

async function readBoard(token) {
  let after = null, project = null;
  const items = [];
  do {
    const data = await graphql(token, ITEMS_QUERY, { owner: OWNER, number: PROJECT_NUMBER, after });
    const p = data.user?.projectV2;
    if (!p) throw new Error('board: NOT synced — the project is not visible to this token');
    project = project || { id: p.id, fields: p.fields.nodes.filter((f) => f.name) };
    for (const n of p.items.nodes) {
      const fv = {};
      for (const v of n.fieldValues.nodes) if (v.field) fv[v.field.name] = v.name;
      const c = n.content;
      const content = !c ? null
        : c.__typename === 'Issue'
          ? { kind: 'Issue', number: c.number, state: c.state.toLowerCase(), title: c.title, labels: c.labels.nodes.map((l) => l.name) }
          : c.__typename === 'PullRequest'
            ? { kind: 'PullRequest', number: c.number, state: c.state === 'OPEN' ? 'open' : 'closed', title: c.title }
            : { kind: 'Draft', title: c.title };
      items.push({ id: n.id, isArchived: n.isArchived, content, status: fv.Status || null, priority: fv.Priority || null });
    }
    after = p.items.pageInfo.hasNextPage ? p.items.pageInfo.endCursor : null;
  } while (after);
  return { project, items };
}

async function readRepo(token) {
  const [issues, pulls, branches] = await Promise.all([
    api(token, '/issues?state=open'),
    api(token, '/pulls?state=open'),
    api(token, '/branches'),
  ]);
  return {
    openIssues: issues.filter((i) => !i.pull_request).map((i) => ({
      number: i.number, state: i.state, title: i.title, nodeId: i.node_id, labels: i.labels.map((l) => l.name),
    })),
    repo: {
      prs: pulls.map((p) => ({ number: p.number, title: p.title, body: p.body || '', draft: p.draft, labels: p.labels.map((l) => l.name) })),
      branches: branches.map((b) => b.name),
    },
  };
}

async function apply(token, project, changes) {
  const field = (name) => {
    const f = project.fields.find((x) => x.name === name);
    if (!f) throw new Error(`board: NOT synced — the board has no "${name}" field`);
    return f;
  };
  const option = (name, value) => {
    const o = field(name).options.find((x) => x.name === value);
    if (!o) throw new Error(`board: NOT synced — "${name}" has no "${value}" option; add it on the board first`);
    return o.id;
  };
  const set = (itemId, name, value) => value === null
    ? graphql(token, `mutation($p:ID!, $i:ID!, $f:ID!) { clearProjectV2ItemFieldValue(input:{projectId:$p, itemId:$i, fieldId:$f}) { clientMutationId } }`,
      { p: project.id, i: itemId, f: field(name).id })
    : graphql(token, `mutation($p:ID!, $i:ID!, $f:ID!, $o:String!) { updateProjectV2ItemFieldValue(input:{projectId:$p, itemId:$i, fieldId:$f, value:{singleSelectOptionId:$o}}) { clientMutationId } }`,
      { p: project.id, i: itemId, f: field(name).id, o: option(name, value) });

  for (const ch of changes) {
    if (ch.kind === 'archive') {
      await graphql(token, `mutation($p:ID!, $i:ID!) { archiveProjectV2Item(input:{projectId:$p, itemId:$i}) { clientMutationId } }`, { p: project.id, i: ch.itemId });
    } else if (ch.kind === 'add') {
      const data = await graphql(token, `mutation($p:ID!, $c:ID!) { addProjectV2ItemById(input:{projectId:$p, contentId:$c}) { item { id } } }`, { p: project.id, c: ch.nodeId });
      const itemId = data.addProjectV2ItemById.item.id;
      await set(itemId, 'Status', ch.to);
      if (ch.priority) await set(itemId, 'Priority', ch.priority);
    } else {
      await set(ch.itemId, ch.kind === 'status' ? 'Status' : 'Priority', ch.to);
    }
  }
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const dryRun = argv.includes('--dry-run');
  const projectToken = resolveProjectToken(env);
  const repoToken = env.GITHUB_TOKEN || env.GH_TOKEN || projectToken;
  const [{ project, items }, { openIssues, repo }] = await Promise.all([readBoard(projectToken), readRepo(repoToken)]);
  const changes = plan({ items, openIssues, repo });
  if (!dryRun) await apply(projectToken, project, changes);
  // The card count is what the board shows AFTER this run: live cards, less the ones this run archives.
  const cards = items.filter((i) => !i.isArchived).length - changes.filter((c) => c.kind === 'archive').length;
  const line = summary(changes, cards, dryRun, argv.includes('--all') ? Infinity : 8);
  if (dryRun) return line;
  const pulse = await writePulse(repoToken, summary(changes, cards, false), changes);   // last, on purpose
  return `${line} · ${pulse}`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((line) => console.log(line), (err) => { console.error(err.message); process.exit(2); });
}

/**
 * STEP 3's query (`docs/ROUTINE-PROMPT.md`), run for the developer run instead of read by it (#1374).
 *
 * One page of the routine-ok query is over 1 MB of JSON (about 250K tokens) and the run needs a few hundred
 * bytes of it. This fetches, projects and applies STEP 3's rules 1–5, and prints the pick. The rules stay the
 * binding text in the prompt; a run whose output contradicts them follows the rules. `tests/unit/pick-issue.test.ts`
 * holds this file's label list and priority order equal to the prompt's.
 *
 * Issue text is data (#215): it is only ever printed, never passed to a shell.
 */
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { PRIORITIES } from './board-sync.mjs';

export const REPO = 'ugurozsahin/sky-academy';
export const CREATOR = 'ugurozsahin';
/** Rule 1: dropped outright. */
export const DROP_LABELS = ['later', 'owner-session', 'epic'];
/** Rule 1: dropped unless a non-visual part is separable, which only a reader can judge, so they are listed. */
export const HELD_LABELS = ['owner-input', 'owner-approval'];

const names = (i) => (i.labels || []).map((l) => (typeof l === 'string' ? l : l.name));

/** The numbers a body's first line `Blocked by …` names, and whether it names another repository's issue. */
export function blockedBy(body) {
  const first = (body || '').replace(/^\s+/, '').split('\n')[0];
  const m = /^Blocked by\b(.*)$/i.exec(first);
  if (!m) return { numbers: [], foreign: false };
  const foreign = /[\w.-]+\/[\w.-]+#\d+/.test(m[1]);
  const rest = m[1].replace(/[\w.-]+\/[\w.-]+#\d+/g, '');
  return { numbers: [...rest.matchAll(/#(\d+)/g)].map((x) => Number(x[1])), foreign };
}

/** An open PR "solving" issue n: its branch, its title or a closing keyword in its body names n. */
export function prSolves(pr, n) {
  const ref = (pr.head && pr.head.ref) || '';
  return (
    new RegExp(`^(feature|fix|chore)/${n}-`).test(ref) ||
    new RegExp(`\\(#${n}\\)`).test(pr.title || '') ||
    new RegExp(`\\b(closes|fixes|resolves|part of)\\s+#${n}\\b`, 'i').test(pr.body || '')
  );
}

const priorityOf = (i) => {
  const at = PRIORITIES.findIndex((p) => names(i).includes(`priority:${p}`));
  return at === -1 ? PRIORITIES.length : at;
};

/**
 * `candidates`: the open routine-ok issues the owner's account created. `prs`: every open PR. `open`: the set of
 * every open issue and PR number, read live. Returns the ranked eligible issues and, per reason, what was dropped.
 */
export function pickIssue({ candidates, prs, open }) {
  const dropped = { label: [], held: [], heartbeat: [], openPr: [], blocked: [] };
  const named = new Set();
  const eligible = [];
  for (const i of candidates) {
    const ls = names(i);
    if (i.pull_request) continue;
    if (ls.some((l) => DROP_LABELS.includes(l))) { dropped.label.push(i.number); continue; }
    if (ls.some((l) => HELD_LABELS.includes(l))) { dropped.held.push(i.number); continue; }
    if (/: heartbeat/i.test(i.title || '')) { dropped.heartbeat.push(i.number); continue; }
    const b = blockedBy(i.body);
    b.numbers.forEach((n) => named.add(n));
    if (prs.some((p) => prSolves(p, i.number))) { dropped.openPr.push(i.number); continue; }
    if (b.foreign || b.numbers.some((n) => open.has(n))) { dropped.blocked.push(i.number); continue; }
    eligible.push(i);
  }
  eligible.sort((a, b) => priorityOf(a) - priorityOf(b) || a.number - b.number);
  return { ranked: eligible, dropped, blockersRead: named.size };
}

const clean = (s) => String(s || '').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 70);
const tag = (i) => { const p = priorityOf(i); return p < PRIORITIES.length ? PRIORITIES[p] : 'none'; };
const list = (a) => (a.length ? ` [${a.slice(0, 12).map((n) => `#${n}`).join(' ')}${a.length > 12 ? ' …' : ''}]` : '');

export function report({ ranked, dropped, blockersRead }, total) {
  const top = ranked[0];
  const out = [
    top
      ? `top pick: #${top.number} (${tag(top)}) · ${blockersRead} blockers read live`
      : `top pick: none eligible · ${blockersRead} blockers read live`,
    ...ranked.slice(0, 6).map((i) => `  #${i.number} ${tag(i)} ${clean(i.title)}`),
    `${total} candidates, ${ranked.length} eligible. dropped: label ${dropped.label.length}, ` +
      `heartbeat ${dropped.heartbeat.length}, open PR ${dropped.openPr.length}${list(dropped.openPr)}, ` +
      `blocked ${dropped.blocked.length}`,
    `held for judgement (owner-input/owner-approval, rule 1): ${dropped.held.length}${list(dropped.held)}`,
  ];
  return out.join('\n');
}

function token() {
  const t = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (t) return t;
  try { return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim(); } catch { return ''; }
}

async function fetchAll(path, tok) {
  const all = [];
  for (let page = 1; page < 30; page++) {
    const sep = path.includes('?') ? '&' : '?';
    const res = await fetch(`https://api.github.com${path}${sep}per_page=100&page=${page}`, {
      headers: { authorization: `Bearer ${tok}`, accept: 'application/vnd.github+json', 'user-agent': 'pick-issue' },
    });
    if (!res.ok) throw new Error(`GET ${path} page ${page}: HTTP ${res.status}`);
    const rows = await res.json();
    all.push(...rows);
    if (rows.length < 100) return all;
  }
  throw new Error(`GET ${path}: more than 29 pages`);
}

async function main() {
  const tok = token();
  if (!tok) { console.error('pick-issue: no $GITHUB_TOKEN/$GH_TOKEN and no `gh auth token`'); process.exit(2); }
  const [candidates, prs, everyOpen] = await Promise.all([
    fetchAll(`/repos/${REPO}/issues?state=open&labels=routine-ok&creator=${CREATOR}`, tok),
    fetchAll(`/repos/${REPO}/pulls?state=open`, tok),
    fetchAll(`/repos/${REPO}/issues?state=open`, tok),
  ]);
  const open = new Set(everyOpen.map((i) => i.number));
  console.log(report(pickIssue({ candidates, prs, open }), candidates.length));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(`pick-issue: ${e.message}`); process.exit(1); });
}

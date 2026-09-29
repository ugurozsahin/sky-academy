/**
 * Which open issues carry a `blocked` label that has outlived its reason (#1360)?
 *
 * `.claude/rules/governance.md` pairs the `blocked` label with a `Blocked by #<n>` first line. The line goes
 * stale by itself the moment #n closes; the label did not, and only the refiner's one-day gate took it off.
 * On 2026-09-29 that left 68 issues parked, 18 of them `priority:P1`, while lower-priority work was taken
 * (#1348). `.github/workflows/unblock.yml` calls this and removes the label from what it returns.
 *
 * Pure, so `tests/unit/unblock.test.ts` holds it to both directions. Every doubt fails towards keeping the
 * label: taking it off wrongly puts parked work in front of an hourly developer run, while leaving it on
 * costs a day until the refiner's backstop proposal.
 */

/**
 * The issue numbers named on a body's first line, when that line opens `Blocked by`. `null` when there is no
 * such line, no number on it, or a reference into another repository — whose state this repo cannot read,
 * so it is never read as closed. Every `#<n>` on the line counts, prose included: more numbers can only keep
 * a label on, never take one off.
 */
export function blockersOf(body) {
  const first = (body || '').replace(/^\s+/, '').split('\n')[0];
  const m = /^Blocked by\b(.*)$/i.exec(first);
  if (!m) return null;
  if (/[\w.-]+\/[\w.-]+#\d+/.test(m[1])) return null;
  const ns = [...m[1].matchAll(/#(\d+)/g)].map((x) => Number(x[1]));
  return ns.length ? ns : null;
}

/**
 * `open` is every open issue and pull request in the repository, as one listing returns them; `closedNow` is
 * the issue whose closing woke the run, in case the listing still shows it open. Returns the numbers of the
 * open `blocked` issues whose every named blocker is closed.
 */
export function staleBlocked(open, closedNow) {
  const isOpen = new Set(open.map((i) => i.number));
  if (closedNow != null) isOpen.delete(closedNow);
  return open
    .filter((i) => !i.pull_request && (i.labels || []).some((l) => (typeof l === 'string' ? l : l.name) === 'blocked'))
    .filter((i) => {
      const ns = blockersOf(i.body);
      return ns !== null && ns.every((n) => !isOpen.has(n));
    })
    .map((i) => i.number);
}

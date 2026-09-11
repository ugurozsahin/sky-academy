import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain ESM helper run by the routine from the shell (see scripts/board-sync.d.ts)
import { PULSE, STATUS, branchIssue, desiredPriority, desiredStatus, isNonWork, linkedIssues, plan, pulseLine, pulseNeeded, pulseTime, resolveProjectToken, summary } from '../../scripts/board-sync.mjs';
import type { Change, Item, IssueLike, Repo } from '../../scripts/board-sync';

/**
 * The board is a projection of the repository (#158): every Status is derived from state the repo already
 * carries, and a board that already matches produces no writes. Each case below is one row of the rule
 * table in docs/ROUTINE-PROMPT.md, plus the precedence between rows — which is where a projection goes
 * wrong: a closed issue with `owner-input` is Done, not Owner action; a parked P1 is Backlog, not Ready.
 */
const issue = (n: number, labels: string[] = [], state: 'open' | 'closed' = 'open', title = `Issue ${n}`): IssueLike =>
  ({ number: n, state, labels, title });
const quiet: Repo = { prs: [], branches: [] };
const withPr = (n: number, labels: string[] = [], body = `Closes #${n}`): Repo =>
  ({ prs: [{ number: 900, title: `Thing (#${n})`, body, labels }], branches: [] });

describe('board sync: the Status rule, first match wins (#158)', () => {
  it.each<[string, IssueLike, Repo, string]>([
    ['closed → Done', issue(1, ['priority:P1'], 'closed'), quiet, STATUS.DONE],
    ['closed beats every open-state row, even Owner action', issue(1, ['owner-input'], 'closed'), withPr(1, ['owner-approval']), STATUS.DONE],
    ['open PR + owner-approval on the PR → Owner action', issue(2, ['priority:P1']), withPr(2, ['owner-approval']), STATUS.OWNER],
    ['open PR + owner-approval on the issue → Owner action', issue(2, ['owner-approval']), withPr(2), STATUS.OWNER],
    ['open PR → In review', issue(3, ['priority:P1']), withPr(3), STATUS.REVIEW],
    ['open PR wins over owner-input', issue(3, ['owner-input']), withPr(3), STATUS.REVIEW],
    ['open PR saying Part of → In review', issue(3), withPr(3, [], 'Part of #3 — the rest stays open'), STATUS.REVIEW],
    ['a branch named for the issue, no PR → In progress', issue(4, ['priority:P2']), { prs: [], branches: ['main', 'chore/4-board-sync'] }, STATUS.PROGRESS],
    ['a PR wins over the branch that carries it', issue(4), { ...withPr(4), branches: ['fix/4-x'] }, STATUS.REVIEW],
    ['owner-input → Owner action', issue(5, ['owner-input', 'priority:P1']), quiet, STATUS.OWNER],
    ['owner-approval on the issue → Owner action', issue(5, ['owner-approval']), quiet, STATUS.OWNER],
    ['blocked → Blocked', issue(6, ['blocked', 'priority:P1']), quiet, STATUS.BLOCKED],
    ['owner-input wins over blocked', issue(6, ['blocked', 'owner-input']), quiet, STATUS.OWNER],
    ['later → Backlog, even at P1 (#8 is exactly this)', issue(8, ['later', 'priority:P1', 'routine-ok']), quiet, STATUS.BACKLOG],
    ['blocked wins over later', issue(8, ['later', 'blocked']), quiet, STATUS.BLOCKED],
    ['priority:P1 → Ready', issue(9, ['priority:P1']), quiet, STATUS.READY],
    ['priority:P0 → Ready', issue(9, ['priority:P0']), quiet, STATUS.READY],
    ['priority:P2 → Backlog', issue(10, ['priority:P2']), quiet, STATUS.BACKLOG],
    ['no priority → Backlog', issue(11, ['routine-ok']), quiet, STATUS.BACKLOG],
  ])('%s', (_name, iss, repo, want) => {
    expect(desiredStatus(iss, repo)).toBe(want);
  });

  // The retired `frozen` label is not a rule any more (BACKLOG.md) — it must not resurrect Blocked.
  it('frozen means nothing', () => {
    expect(desiredStatus(issue(12, ['frozen', 'priority:P1']), quiet)).toBe(STATUS.READY);
  });

  it('a PR linked to a different issue does not move this one', () => {
    expect(desiredStatus(issue(13, ['priority:P1']), withPr(14))).toBe(STATUS.READY);
    expect(desiredStatus(issue(13, ['priority:P1']), withPr(130))).toBe(STATUS.READY);   // #130 is not #13
  });
});

describe('board sync: Priority mirrors the label', () => {
  it.each<[string[], string | null]>([
    [['priority:P0'], 'P0'], [['priority:P1', 'bug'], 'P1'], [['priority:P2'], 'P2'], [['priority:P3'], 'P3'],
    [['routine-ok'], null], [[], null],
    [['priority:P2', 'priority:P1'], 'P1'],      // two labels is a mistake on the issue; mirror the higher
  ])('%j → %j', (labels, want) => {
    expect(desiredPriority(labels)).toBe(want);
  });
});

describe('board sync: what links a PR to an issue', () => {
  it('reads the title suffix, Closes and Part of, and nothing else', () => {
    expect(linkedIssues({ title: 'Opening screen (#110)', body: 'Closes #110.' })).toEqual([110]);
    expect(linkedIssues({ title: 'Save export', body: 'Part of #64 — the keystore half stays open' })).toEqual([64]);
    expect(linkedIssues({ title: 'x', body: 'Closes #12, part of #13, see #14' })).toEqual([12, 13]);
    expect(linkedIssues({ title: 'x', body: 'mentions #15 and issue 16' })).toEqual([]);
    expect(linkedIssues({ title: 'x', body: '' })).toEqual([]);
  });
});

describe('board sync: which branch is whose (#160)', () => {
  it.each<[string, number | null]>([
    ['chore/158-board-sync', 158], ['fix/107-tablet-five-frame-overflow', 107], ['feature/48-ninja-star', 48],
    ['claude/issue-27', 27],                    // the retired shape, still on a few unmerged branches
    ['claude/jolly-franklin-c57bw1', null], ['main', null], ['chore/board-sync', null], ['', null],
  ])('%s → %j', (name, want) => {
    expect(branchIssue(name)).toBe(want);
  });
});

describe('board sync: cards that are not work', () => {
  it('the two pulses and the retired ordered list, and nothing that merely mentions them', () => {
    expect(isNonWork({ title: 'routine: heartbeat', labels: ['watchdog'] })).toBe(true);
    expect(isNonWork({ title: 'watchdog: heartbeat', labels: ['watchdog'] })).toBe(true);
    expect(isNonWork({ title: '📌 Priority order (owner-maintained)', labels: ['priority:P1'] })).toBe(true);
    expect(isNonWork({ title: 'watchdog: development routine heartbeat has not updated in 10+ hours', labels: ['watchdog'] })).toBe(false);
    expect(isNonWork({ title: 'routine: heartbeat', labels: [] })).toBe(false);   // the label is half the test
    expect(isNonWork({ title: 'Keep the board in step', labels: ['routine-ok'] })).toBe(false);
  });
});

describe('board sync: the plan is a diff, and a matching board is an empty one', () => {
  const card = (id: string, content: Item['content'], status: string | null, priority: string | null, isArchived = false): Item =>
    ({ id, isArchived, content, status, priority });
  const iss = (n: number, labels: string[], state: 'open' | 'closed' = 'open', title = `Issue ${n}`) =>
    ({ kind: 'Issue' as const, number: n, state, labels, title });

  const items: Item[] = [
    card('a', iss(1, ['priority:P1'], 'closed'), 'Ready', 'P1'),                    // closed, still Ready
    card('b', iss(2, ['priority:P2']), 'Backlog', 'P1'),                            // priority drifted
    card('c', iss(3, ['priority:P1']), 'Ready', 'P1'),                              // already right
    card('d', iss(4, ['routine-ok']), null, null),                                  // never given a Status
    card('e', iss(106, ['watchdog'], 'open', 'routine: heartbeat'), 'Backlog', null),
    card('f', { kind: 'PullRequest', number: 200, state: 'closed', title: 'x' }, 'In review', null),
    card('g', { kind: 'Draft', title: 'a note' }, null, null),
    card('h', iss(7, ['priority:P1']), 'Backlog', 'P1', true),                      // archived by hand: left alone
    card('i', null, 'Backlog', null),                                               // content the token cannot see
  ];
  const openIssues: IssueLike[] = [
    issue(2, ['priority:P2']), issue(3, ['priority:P1']), issue(4, ['routine-ok']),
    issue(7, ['priority:P1']),                                                      // open, card archived by hand: NOT re-added
    issue(50, ['priority:P1', 'routine-ok']),                                       // open and not on the board
    { ...issue(102, ['watchdog']), title: 'watchdog: heartbeat' },                  // non-work: never added
  ];

  it('names exactly the writes that are needed', () => {
    const changes: Change[] = plan({ items, openIssues, repo: quiet });
    expect(changes).toEqual([
      { kind: 'status', number: 1, itemId: 'a', from: 'Ready', to: 'Done' },
      { kind: 'priority', number: 2, itemId: 'b', from: 'P1', to: 'P2' },
      { kind: 'status', number: 4, itemId: 'd', from: null, to: 'Backlog' },
      { kind: 'archive', number: 106, itemId: 'e' },
      { kind: 'status', number: 200, itemId: 'f', from: 'In review', to: 'Done' },
      { kind: 'add', number: 50, nodeId: undefined, to: 'Ready', priority: 'P1' },
    ]);
  });

  it('is idempotent: applying the plan to the board yields an empty plan', () => {
    const changes: Change[] = plan({ items, openIssues, repo: quiet });
    const after: Item[] = items.map((it) => ({ ...it }));
    for (const ch of changes) {
      const target = after.find((it) => it.id === ch.itemId);
      if (ch.kind === 'status' && target) target.status = ch.to ?? null;
      if (ch.kind === 'priority' && target) target.priority = ch.to ?? null;
      if (ch.kind === 'archive' && target) target.isArchived = true;
      if (ch.kind === 'add') {
        const src = openIssues.find((i) => i.number === ch.number)!;
        after.push(card(`new-${ch.number}`, iss(src.number, src.labels), ch.to ?? null, ch.priority ?? null));
      }
    }
    expect(plan({ items: after, openIssues, repo: quiet })).toEqual([]);
  });

  it('an open issue whose card was archived by hand stays archived (first review of #197)', () => {
    // Before the fix the archived card was skipped before being counted as on the board, so the open issue
    // behind it was re-added on every run — a sync that fights the owner every fifteen minutes.
    const changes: Change[] = plan({ items, openIssues, repo: quiet });
    expect(changes.filter((c) => c.number === 7)).toEqual([]);
    expect(changes.filter((c) => c.kind === 'add').map((c) => c.number)).toEqual([50]);
  });

  it('never writes a label, closes an issue or touches a pull request', () => {
    // The arrows point one way. A change kind that is not one of these four would be a second source of truth.
    const kinds = new Set((plan({ items, openIssues, repo: quiet }) as Change[]).map((c) => c.kind));
    for (const k of kinds) expect(['add', 'archive', 'status', 'priority']).toContain(k);
  });
});

describe('board sync: what the heartbeat line says', () => {
  it('carries the count and the first few changes, or says in step with the card count', () => {
    expect(summary([], 60, false)).toBe('board: in step — 0 changes, 60 cards');
    expect(summary([{ kind: 'status', number: 1, from: 'Ready', to: 'Done' }], 60, false))
      .toBe('board: synced 1: #1 status Ready → Done');
    expect(summary([{ kind: 'add', number: 50, to: 'Ready' }, { kind: 'archive', number: 106 }], 60, true))
      .toBe('board: would change 2: #50 added → Ready, #106 archived');
    const many: Change[] = Array.from({ length: 12 }, (_, i) => ({ kind: 'priority', number: i, from: null, to: 'P2' }));
    expect(summary(many, 60, false)).toMatch(/^board: synced 12: .*\(\+4 more\)$/);
  });
});

describe('board sync: the pulse the cloud agents read', () => {
  const t = (iso: string) => new Date(iso);
  const change: Change = { kind: 'status', number: 1, from: 'Ready', to: 'Done' };

  it('parses the timestamp the body starts with, and nothing else', () => {
    expect(pulseTime('2026-09-11T17:10Z — in step')?.toISOString()).toBe('2026-09-11T17:10:00.000Z');
    expect(pulseTime('  2026-09-11T17:10:30Z — synced 3')?.toISOString()).toBe('2026-09-11T17:10:30.000Z');
    expect(pulseTime('synced at 2026-09-11T17:10Z')).toBeNull();     // not at the start: not a pulse
    expect(pulseTime('')).toBeNull();
    expect(pulseTime(null)).toBeNull();
  });

  it('rewrites when something changed, when the pulse is unreadable, or when it is an hour old', () => {
    const now = t('2026-09-11T17:10:00Z');
    expect(pulseNeeded('2026-09-11T17:00Z — in step', now, [change])).toBe(true);     // changed
    expect(pulseNeeded('', now, [])).toBe(true);                                       // empty = dead pulse
    expect(pulseNeeded('no timestamp here', now, [])).toBe(true);
    expect(pulseNeeded('2026-09-11T16:10Z — in step', now, [])).toBe(true);            // exactly an hour
    expect(pulseNeeded('2026-09-11T16:11Z — in step', now, [])).toBe(false);           // 59 minutes: keep
    expect(pulseNeeded('2026-09-11T17:00Z — in step', now, [])).toBe(false);
  });

  it('writes a line the routine and the watchdog can parse back', () => {
    const line = pulseLine(t('2026-09-11T17:10:30Z'), 'board: in step — 0 changes, 59 cards');
    expect(line).toBe('2026-09-11T17:10Z — board: in step — 0 changes, 59 cards');
    expect(pulseTime(line)?.toISOString()).toBe('2026-09-11T17:10:00.000Z');
    expect(PULSE.title).toBe('board: heartbeat');
    expect(PULSE.labels).toEqual(['watchdog']);                 // which is what makes it non-work above
    expect(isNonWork({ title: PULSE.title, labels: PULSE.labels })).toBe(true);
  });
});

describe('board sync: the token fails loudly, never silently', () => {
  it('prefers the environment, then the owner\'s file, then throws a message that says where it looked', () => {
    expect(resolveProjectToken({ GITHUB_PROJECT_TOKEN: ' abc\n' }, '/nowhere')).toBe('abc');
    expect(() => resolveProjectToken({}, '/nowhere')).toThrow(/board: NOT synced — no project token/);
    expect(() => resolveProjectToken({}, '/nowhere')).toThrow(/GITHUB_PROJECT_TOKEN/);
    expect(() => resolveProjectToken({}, '/nowhere')).toThrow(/\.git\/github-project-token/);
  });
});

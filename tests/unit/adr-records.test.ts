import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The decision records as a set (#350, split into #654-#657): their shape, their numbers, and the three figures
 * the incident record carries. The pointer rails are in `instructions.test.ts`.
 *
 * Prove it red: add `docs/decisions/003-x.md`, `docs/decisions/099-x/README.md` or `docs/decisions/099-x.txt`;
 * put a record-shaped `NNN-x.md` under `.claude/rules/`; flip a figure below back to the value it replaced.
 */
const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (f: string) => readFileSync(join(root, f), 'utf8');

const RECORD_NAME = /^(\d{3})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
/** The record numbers that appear more than once in a list of file names. */
const duplicateNumbers = (names: string[]) => {
  const seen = new Map<string, number>();
  for (const n of names) { const num = RECORD_NAME.exec(n)?.[1]; if (num) seen.set(num, (seen.get(num) ?? 0) + 1); }
  return [...seen].filter(([, count]) => count > 1).map(([num]) => num);
};

describe('the decision records are a flat set of numbered, uniquely numbered .md files (#654, #657)', () => {
  const entries = readdirSync(join(root, 'docs/decisions'));

  it('every entry of docs/decisions/ is NNN-slug.md, so none sits where the pointer rail cannot see it', () => {
    expect(entries.filter((e) => !RECORD_NAME.test(e)), 'a record in the wrong shape (nested, not .md, not numbered)').toEqual([]);
    expect(entries.length, 'the decision records have gone missing').toBeGreaterThan(0);
  });

  it('no two records share a number: the renumber rule in governance.md holds (#657)', () => {
    expect(duplicateNumbers(entries), 'two records claim the same number').toEqual([]);
  });

  it('finds a shared number in a crafted pair and ignores distinct ones', () => {
    expect(duplicateNumbers(['007-a.md', '007-b.md', '008-c.md'])).toEqual(['007']);
    expect(duplicateNumbers(['007-a.md', '008-b.md', 'README.md'])).toEqual([]);
  });

  it('no record-shaped file lives outside docs/decisions/, where it would join the corpus the pointer rail searches', () => {
    const dirs = ['.claude/rules', 'docs'];
    const stray = dirs.flatMap((d) => readdirSync(join(root, d)).filter((e) => RECORD_NAME.test(e)).map((e) => `${d}/${e}`));
    expect(stray).toEqual([]);
  });
});

/**
 * #656: the bullet in governance.md that decides whether a decision gets a record at all (acceptance item 2 of
 * #316) was pinned by nothing; deleting it left the suite green. Its test and its renumber rule are pinned by
 * whole clauses, whitespace-flattened. The bullet's other wording is free to be edited.
 */
describe('governance.md still carries the criterion for when a decision needs a record (#656, #316)', () => {
  const g = read('.claude/rules/governance.md').replace(/\s+/g, ' ');

  it.each([
    '**When a decision needs a `docs/decisions/` record and not just an issue.**',
    'write the ADR when the decision binds work beyond the issue that prompted it, or when a real alternative was rejected.**',
    'with the alternatives that were dropped and why',
    'Take the next free number at the moment you write the file, and if an open pull request has already claimed it, renumber yours',
    'pointed at, in a code span with its full path, by a live instruction file',
    'that the pointer is one a run would follow stays the reviewer\'s call',
    'now ADR 004, and the run pulse (#314/PR #315), now ADR 005',
  ])('keeps the clause %#', (clause) => {
    expect(g).toContain(clause);
  });
});

/**
 * #655: PR #292 (#150) is the incident `docs/decisions/004-what-a-review-block-is-for.md` and `review-pr` §7 are
 * written from, and it is merged, so its figures are fixed. Review rounds 1 and 2 of PR #318 were spent
 * correcting them (six rounds to seven, five hours to 6h14m, 254 lines to 276); nothing held the corrected
 * values, and a fourth copy of the old ones survived in a test comment. The old values are built from parts so
 * this file does not itself contain them.
 */
describe('the PR #292 figures review-pr §7 and ADR 004 carry are the corrected ones (#655)', () => {
  const skill = read('.claude/skills/review-pr/SKILL.md');
  const s7 = skill.slice(skill.indexOf('## 7. '), skill.indexOf('\n## ', skill.indexOf('## 7. ') + 1));
  const flat = (t: string) => t.replace(/\s+/g, ' ');
  const adr = flat(read('docs/decisions/004-what-a-review-block-is-for.md'));
  const stale = [['six', ' rounds'], ['over five', ' hours'],['254', ' lines'], ['blocked six', ' times']].map((p) => p.join(''));

  it('§7 says seven rounds, 6h14m and 276 lines', () => {
    const t = flat(s7);
    expect(t).toContain('took **seven rounds of `REVIEW: CHANGES REQUESTED`** across 6h14m and seven pushes');
    expect(t).toContain('had become 276 lines modelling a YAML parser');
  });

  it('ADR 004 says seven pushes, 6h14m and 276 lines', () => {
    expect(adr).toContain('Seven pushes, 6h14m, 276 lines added to one test file');
  });

  it('no copy of the superseded figures remains in §7, ADR 004, governance.md or the two big test files', () => {
    const copies: Record<string, string> = {
      'review-pr §7': s7, 'ADR 004': adr, 'governance.md': read('.claude/rules/governance.md'),
      'governance.test.ts': read('tests/unit/governance.test.ts'), 'guardrails.test.ts': read('tests/unit/guardrails.test.ts'),
    };
    const found = Object.entries(copies).flatMap(([name, text]) => stale.filter((s) => flat(text).includes(s)).map((s) => `${name}: ${s}`));
    expect(found, 'an old PR #292 figure is back').toEqual([]);
  });
});

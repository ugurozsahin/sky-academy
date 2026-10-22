import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PLAYTESTERS } from './helpers/playtest';

/**
 * Rails for the agent instruction files themselves (docs/decisions/001-one-home-per-rule.md).
 *
 * A rule has one home and every other file points at it, so the failure to guard against is a pointer to
 * nothing: a file moved or deleted while `→ see X` still stands, which leaves a run with no rule and no error.
 * This checks that the file exists — not that it still says what the pointer promises; that is the reviewer's.
 * It pins no wording: instruction prose has to stay free to shrink.
 */
const root = fileURLToPath(new URL('../../', import.meta.url));

// Every skill is one or the other; a new directory fails the test below until it is put in a list, so a
// project skill cannot go unread here without anyone noticing.
const OWN_SKILLS = ['add-guard-rail', 'add-topic', 'design-language', 'open-pr', 'pick-issue', 'playtest', 'qa-screenshot', 'review-pr',
                    'three-art'];
// The agents written for this project (#2204): their pointers are read like a skill's. The three vendored review
// agents point at nothing here. `governance.test.ts`'s `AGENTS` map is the allow-list and marks these `null` from the
// same `PLAYTESTERS` list; this is only the reading list, so it reads by that name, not by a file-name prefix (#2213).
const OWN_AGENTS = PLAYTESTERS.map((n) => `.claude/agents/${n}.md`);
const VENDORED_SKILLS = ['frontend-design', 'systematic-debugging', 'test-driven-development', 'using-git-worktrees',
                         'verification-before-completion'];   // pinned upstream; they point at their own siblings

const mdIn = (dir: string) => readdirSync(join(root, dir)).filter((f) => f.endsWith('.md')).map((f) => `${dir}/${f}`);
const ADR_FILES = mdIn('docs/decisions');   // the record set, named once: both halves below derive from it (#654)
const INSTRUCTION_FILES = [
  'CLAUDE.md', 'AGENTS.md', 'README.md', 'docs/ROUTINE-PROMPT.md', 'docs/REVIEWER-PROMPT.md',
  'docs/WATCHDOG-PROMPT.md', 'docs/REFINER-PROMPT.md', ...mdIn('.claude/rules'), ...ADR_FILES, ...OWN_SKILLS.map((s) => `.claude/skills/${s}/SKILL.md`),
  ...OWN_AGENTS,
];
// The instruction files a session reads to be told what to do. The decision records are excluded because they
// are the thing pointed *at*: counting them would let ADRs satisfy the rails below by citing one another, and
// would let a retired file stay "named" by the history that records its retirement.
const LIVE_FILES = INSTRUCTION_FILES.filter((f) => !ADR_FILES.includes(f));
const read = (f: string) => readFileSync(join(root, f), 'utf8');

// A repo path anywhere inside a code span — alone, or as an argument of a command: a path under a tracked
// top-level directory, or one of the root files these documents point at by bare name.
const ROOT_FILES = ['CLAUDE.md', 'AGENTS.md', 'BACKLOG.md', 'package.json', 'vite.config.ts', 'playwright.config.ts',
                    'capacitor.config.ts'];
const DIRS = ['.claude', '.github', 'android', 'docs', 'public', 'scripts', 'src', 'tests'];
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');   // every regex metacharacter, not only the dot
const pathPattern = (dirs: string[], rootFiles: string[]) => new RegExp(
  `(?<![\\w/.~-])((?:${dirs.map(esc).join('|')})/[^\\s\`]*|(?:${rootFiles.map(esc).join('|')})(?![\\w/-]))`, 'g');
const PATH_IN_SPAN = pathPattern(DIRS, ROOT_FILES);
// A literal path: not a glob or a `<n>` placeholder, not the decision-record placeholder
// `docs/decisions/NNN-title.md`, not a file written at run time. Anchored on purpose (#261): a real path that
// merely contains `NNN` or dots is still checked, and an elided path fails loudly rather than being skipped.
const isLiteral = (p: string) => !/[*<>{}$]|(^|\/)NNN-[\w-]+\.md$|instructions-loaded\.log$/.test(p);
// Named on purpose, to say they are gone, must not be used — or do not exist *yet*: the 3-D rules and skill
// (#716) landed before the tree they govern, so that #714 and #715 build to a rule rather than before one. The
// test below holds each still absent, so the pull request that creates a path has to drop its entry here, and
// this rail goes back to checking the real path.
const KNOWN_ABSENT: Record<string, string> = {
  'scripts/output/': 'named only to forbid it: qa-screenshot says never to save a screenshot there',
  'BACKLOG.md': 'retired (#218) — the decision records name it as history; no live instruction file may',
};

/** The repo paths a document points at, from its code spans, as they would be looked up on disk. */
const pointersIn = (text: string, pattern = PATH_IN_SPAN): string[] => [...new Set(
  [...text.matchAll(/`([^`\n]+)`/g)].flatMap((span) => [...span[1].matchAll(pattern)].map((m) => m[1]))
    .map((p) => p.replace(/(?::\d+.*|#.*)$/, '').replace(/[.,;:)'"]+$/, ''))
    .filter(isLiteral))];
const danglingIn = (text: string) => pointersIn(text).filter((p) => !(p in KNOWN_ABSENT) && !existsSync(join(root, p)));

describe('agent instruction files', () => {
  it.each(INSTRUCTION_FILES)('%s points only at paths that exist', (file) => {
    expect(danglingIn(readFileSync(join(root, file), 'utf8')), `${file} points at paths that do not exist`).toEqual([]);
  });

  it('finds a dangling pointer alone in a span, inside a command, at the root, with a line number or anchor', () => {
    expect(danglingIn('see `docs/gone.md`, run `node scripts/gone.mjs body.md`, read `scripts/gone2.mjs:12` and '
      + '`docs/gone3.md#why`.')).toEqual(['docs/gone.md', 'scripts/gone.mjs', 'scripts/gone2.mjs', 'docs/gone3.md']);
    // The root files are checked by name — how every pointer at BACKLOG.md was found the day it retired (#218).
    expect(pointersIn('`CLAUDE.md` and `BACKLOG.md`, and `npm test` reads `package.json`.'))
      .toEqual(['CLAUDE.md', 'BACKLOG.md', 'package.json']);
  });

  it('leaves alone what is not a pointer into this repo', () => {
    expect(pointersIn('`src/curriculum/**`, `docs/decisions/NNN-title.md`, `feature/<n>-<slug>`, a URL path '
      + '`GET /repos/o/r/contents/docs/x.md`, prose docs/not-in-a-span.md, `~/.claude/settings.json`')).toEqual([]);
    expect(danglingIn('`scripts/output/`')).toEqual([]);
  });

  // #261: both gaps were latent — nothing in the repo hit them — so they are pinned by construction.
  it('takes a directory or root-file name literally, whatever regex characters it holds (#261)', () => {
    const hostile = pathPattern(['foo+bar', 'docs(new)'], ['a.b|c.md']);
    expect(pointersIn('`foo+bar/x.md` `foobar/y.md` `docs(new)/z.md` `a.b|c.md` `aXb` `c.md`', hostile))
      .toEqual(['foo+bar/x.md', 'docs(new)/z.md', 'a.b|c.md']);
  });

  it('skips only the decision-record placeholder, not every path that happens to contain NNN or dots (#261)', () => {
    expect(pointersIn('`docs/decisions/NNN-title.md`, `docs/NNNplan.md`, `scripts/run...later.mjs`'))
      .toEqual(['docs/NNNplan.md', 'scripts/run...later.mjs']);
  });

  it('every KNOWN_ABSENT entry is still absent and still named somewhere', () => {
    const all = INSTRUCTION_FILES.map((f) => readFileSync(join(root, f), 'utf8')).join('\n');
    for (const p of Object.keys(KNOWN_ABSENT)) {
      expect(existsSync(join(root, p)), `${p} exists now — drop it from KNOWN_ABSENT`).toBe(false);
      expect(pointersIn(all), `${p} is no longer named — drop it from KNOWN_ABSENT`).toContain(p);
    }
  });

  // Plain text, not only code spans: the instruction a run acted on was prose — STEP 1's "read CLAUDE.md,
  // BACKLOG.md, and …" — and `README.md`, read by this rail since then, pointed at the file too (review of PR #274).
  it('only the decision records still name the retired BACKLOG.md, in a code span or in prose (#218)', () => {
    expect(LIVE_FILES.length).toBeGreaterThan(12);
    expect(LIVE_FILES.filter((f) => /\bBACKLOG\.md\b/.test(readFileSync(join(root, f), 'utf8'))),
      'a live instruction names a file that is gone').toEqual([]);
  });

  /**
   * Records have readers (#98) — a decision record most of all. An ADR nobody points at is prose that ages
   * out of agreement with the rule it explains, and the first sign is that a run re-argues a decision the
   * owner already made. `.claude/rules/governance.md` carries the test for when a decision needs one at all;
   * this holds the other half, that it is reachable from something a session actually reads.
   *
   * The pointer may sit in any live instruction file, but it must be a **code span** holding the full
   * repo-relative path (#654): that is what `pointersIn` reads, so it is the same extraction the
   * `%s points only at paths that exist` rail runs, and a record that is deleted while its pointer stands goes
   * red there. A prose mention, a bare basename or a glued prefix (`mydocs/decisions/…`) does not count.
   * Beyond "somebody points at it", ADR_POINTERS below names the file a run follows for each record
   * 001-011 (#656), so deleting the functional pointer goes red even while a history sentence in
   * `.claude/rules/governance.md` still names the record. 006 has only that one pointer, so it is one edit from red.
   *
   * What it does not check, so a reviewer does not read more into a green than is there: that the pointer is
   * one a run would follow, or that it still says what the pointer promises — both are the reviewer's, exactly
   * as for the sibling rail above. The shape and numbering of the record set is held by `adr-records.test.ts`.
   *
   * Prove it red: add a file to `docs/decisions/` and point nothing at it; turn a pointer into prose.
   */
  const pointedAt = (files: string[], adr: string) => files.filter((f) => pointersIn(read(f)).includes(adr));

  it('a pointer counts only as a code span holding the full path, not prose, a basename or a glued prefix (#654, #657)', () => {
    const adr = 'docs/decisions/004-what-a-review-block-is-for.md';
    expect(pointersIn(`see \`${adr}\` for why`)).toContain(adr);
    expect(pointersIn(`prose only: ${adr}`)).not.toContain(adr);
    expect(pointersIn('`004-what-a-review-block-is-for.md`')).not.toContain(adr);
    expect(pointersIn(`\`mydocs/${adr}\``)).not.toContain(adr);
  });

  it('the record set partitions the instruction files, and nothing in docs/decisions escapes it (#654)', () => {
    expect(LIVE_FILES.length + ADR_FILES.length, 'a file is both a record and live, or neither').toBe(INSTRUCTION_FILES.length);
    // A nested directory or a non-.md file would be a record by location and absent from ADR_FILES, so nothing
    // would have to point at it: the two counts must agree.
    expect(readdirSync(join(root, 'docs/decisions')).length, 'a record in the wrong shape under docs/decisions/')
      .toBe(ADR_FILES.length);
  });

  it('every decision record is pointed at by a live instruction file (#98)', () => {
    // Vacuity only: an empty directory would pass the assertion below saying nothing. Deliberately not a
    // floor at today's count — retiring a record is a decision a run may legitimately make.
    expect(ADR_FILES.length, 'the decision records have gone missing').toBeGreaterThan(0);
    expect(ADR_FILES.filter((f) => pointedAt(LIVE_FILES, f).length === 0), 'a decision record nothing points at').toEqual([]);
  });

  // The file a run follows to reach each record (#656). Not exhaustive: a record may be added without a row,
  // and the rail above still holds it. Retiring a record means dropping its row here, a visible edit.
  const ADR_POINTERS: Record<string, string> = {
    '001-one-home-per-rule.md': '.claude/skills/open-pr/SKILL.md',
    '002-routine-prompt-is-flow-only.md': 'docs/ROUTINE-PROMPT.md',
    '003-two-routines.md': 'docs/ROUTINE-PROMPT.md',
    '004-what-a-review-block-is-for.md': '.claude/skills/review-pr/SKILL.md',
    '005-the-run-pulse-says-when-a-run-started.md': 'docs/WATCHDOG-PROMPT.md',
    '006-a-routine-never-writes-under-claude.md': '.claude/rules/governance.md',
    '007-a-pulse-stamp-is-read-from-the-clock.md': 'docs/WATCHDOG-PROMPT.md',
    '008-the-backlog-is-refined-by-a-routine.md': 'docs/REFINER-PROMPT.md',
    '009-the-reviewer-pulse-says-who-holds-it.md': 'docs/REVIEWER-PROMPT.md',
    '010-3d-art-is-the-avatars-style.md': 'CLAUDE.md',
    '011-instruction-files-are-measured-by-structure.md': 'CLAUDE.md',
  };

  it.each(Object.entries(ADR_POINTERS))('%s is pointed at from %s, the file a run follows (#656)', (adr, file) => {
    expect(ADR_FILES, `${adr} is gone: drop its row from ADR_POINTERS`).toContain(`docs/decisions/${adr}`);
    expect(pointedAt([file], `docs/decisions/${adr}`), `${file} must point at ${adr} in a code span`).toHaveLength(1);
  });

  it('every skill directory is classed as ours or vendored, so a new one cannot go unread', () => {
    expect(readdirSync(join(root, '.claude/skills')).sort()).toEqual([...OWN_SKILLS, ...VENDORED_SKILLS].sort());
  });

  it('reads a real body of pointers, so the rails above are not vacuous', () => {
    const total = INSTRUCTION_FILES.flatMap((f) => pointersIn(readFileSync(join(root, f), 'utf8'))).length;
    expect(INSTRUCTION_FILES.length).toBeGreaterThan(12);
    expect(total, 'the extraction has gone blind').toBeGreaterThan(100);
  });
});

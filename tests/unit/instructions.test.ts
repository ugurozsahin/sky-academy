import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

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
const OWN_SKILLS = ['add-guard-rail', 'add-topic', 'design-language', 'open-pr', 'qa-screenshot', 'review-pr'];
const VENDORED_SKILLS = ['frontend-design', 'systematic-debugging', 'test-driven-development', 'using-git-worktrees',
                         'verification-before-completion'];   // pinned upstream; they point at their own siblings

const mdIn = (dir: string) => readdirSync(join(root, dir)).filter((f) => f.endsWith('.md')).map((f) => `${dir}/${f}`);
const INSTRUCTION_FILES = [
  'CLAUDE.md', 'AGENTS.md', 'BACKLOG.md', 'docs/ROUTINE-PROMPT.md', 'docs/WATCHDOG-PROMPT.md',
  ...mdIn('.claude/rules'), ...mdIn('docs/decisions'), ...OWN_SKILLS.map((s) => `.claude/skills/${s}/SKILL.md`),
].filter((f) => f !== 'BACKLOG.md' || existsSync(join(root, f)));   // BACKLOG.md is retiring (#218)

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
// Named on purpose, to say they are gone or must not be used.
const KNOWN_ABSENT: Record<string, string> = {
  'scripts/output/': 'named only to forbid it: qa-screenshot says never to save a screenshot there',
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
    // The root files are checked by name, so the day BACKLOG.md retires every pointer still naming it goes red.
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

  it('every skill directory is classed as ours or vendored, so a new one cannot go unread', () => {
    expect(readdirSync(join(root, '.claude/skills')).sort()).toEqual([...OWN_SKILLS, ...VENDORED_SKILLS].sort());
  });

  it('reads a real body of pointers, so the rails above are not vacuous', () => {
    const total = INSTRUCTION_FILES.flatMap((f) => pointersIn(readFileSync(join(root, f), 'utf8'))).length;
    expect(INSTRUCTION_FILES.length).toBeGreaterThan(12);
    expect(total, 'the extraction has gone blind').toBeGreaterThan(100);
  });
});

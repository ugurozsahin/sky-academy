import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Rails for the agent instruction files themselves (docs/decisions/001-one-home-per-rule.md).
 *
 * A rule has one home and every other file points at it, so the failure to guard against is a pointer to
 * nothing: a rule moved or deleted while `→ see X` still stands, which leaves a run with no rule and no error.
 * This does not pin any wording — instruction prose has to stay free to shrink.
 */
const root = fileURLToPath(new URL('../../', import.meta.url));

// The files this project writes for its agents. Vendored skills are left out: they are pinned to an upstream
// commit and point at their own sibling files.
const OWN_SKILLS = ['add-guard-rail', 'add-topic', 'design-language', 'open-pr', 'qa-screenshot', 'review-pr'];
const INSTRUCTION_FILES = [
  'CLAUDE.md', 'docs/ROUTINE-PROMPT.md', 'docs/WATCHDOG-PROMPT.md',
  ...readdirSync(join(root, '.claude/rules')).filter((f) => f.endsWith('.md')).map((f) => `.claude/rules/${f}`),
  ...OWN_SKILLS.map((s) => `.claude/skills/${s}/SKILL.md`),
  ...readdirSync(join(root, 'docs/decisions')).filter((f) => f.endsWith('.md')).map((f) => `docs/decisions/${f}`),
];

// A backticked repo path: starts in a tracked top-level directory, and is a literal path rather than a glob,
// a placeholder (`<n>`, `NNN`) or a file that only exists at run time.
const REPO_PATH = /`((?:\.claude|\.github|docs|scripts|src|tests|public)\/[^`\s]*)`/g;
const isLiteral = (p: string) => !/[*<>{}$]|NNN|\.log$|\.\.\./.test(p);
// Paths named on purpose that a fresh checkout does not have.
const KNOWN_ABSENT = new Set<string>([
  'scripts/output/',   // gitignored: the screenshot scripts create it when they run
]);

describe('agent instruction files', () => {
  it.each(INSTRUCTION_FILES)('%s points only at paths that exist', (file) => {
    const text = readFileSync(join(root, file), 'utf8');
    const paths = [...new Set([...text.matchAll(REPO_PATH)].map((m) => m[1].replace(/[.,;:)]+$/, '')))].filter(isLiteral);
    const dangling = paths.filter((p) => !KNOWN_ABSENT.has(p) && !existsSync(join(root, p)));
    expect(dangling, `${file} points at paths that do not exist`).toEqual([]);
  });

  it('reads a real set of files, so the rail above is not vacuous', () => {
    expect(INSTRUCTION_FILES.length).toBeGreaterThan(12);
    expect(readFileSync(join(root, 'CLAUDE.md'), 'utf8')).toMatch(REPO_PATH);
  });
});

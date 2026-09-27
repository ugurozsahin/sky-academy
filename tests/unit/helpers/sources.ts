import { readdirSync, readFileSync } from 'node:fs';

/**
 * The readers the rail files share (#321). They live here so the split files cannot drift into several
 * slightly different ideas of what "the source" is — and so that a helper going blind is one red rail rather
 * than a whole group quietly passing. `tests/unit/helpers.test.ts` holds that.
 *
 * Every reader here **fails loudly rather than returning nothing**. That is the whole point: a rail suite's
 * characteristic failure is the vacuous pass, and a reader that answers "no files" to a question about files
 * turns every rail downstream of it green at once. `readFileSync` already throws; `inDir` and `workflowFiles`
 * are made to (PR #417 review, note 3).
 */
export const SOURCES = import.meta.glob('/src/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const WORKFLOWS = new URL('../../../.github/workflows/', import.meta.url);

// Vite's glob does not reach `.github/`, so these are read from disk. `readFileSync` throwing on a path that
// moved is the non-vacuity guarantee for the named-file form.
export const workflow = (name: 'ci.yml' | 'review-gate.yml' | 'android.yml') =>
  readFileSync(new URL(name, WORKFLOWS), 'utf8');

/** Every workflow file, for the rails that must hold across all of them rather than one by name. `dir` is
 *  the directory to read, real workflows by default — a test points it at a fixture directory with no
 *  `.yml`/`.yaml` files to prove the vacuity guard actually fires, rather than only reading it in prose (#680). */
export const workflowFiles = (dir: URL = WORKFLOWS): { name: string; text: string }[] => {
  const names = readdirSync(dir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
  if (names.length === 0) throw new Error('no workflow files found — every workflow rail would pass vacuously');
  return names.map((name) => ({ name, text: readFileSync(new URL(name, dir), 'utf8') }));
};

const E2E = new URL('../../../tests/e2e/', import.meta.url);

/** Every `tests/e2e/*.spec.ts` file, for a rail that must hold across all of them (#750). Same vacuity guard
 *  as `workflowFiles` above, kept as its own function rather than a parameterised one: the two directories
 *  read different extensions and neither has a second caller yet, so a shared signature would be guessing at
 *  a shape nothing has asked for. `tests/sketch/` is a different `testDir` (its own `sketchbook` project) and
 *  deliberately not read here. */
export const e2eSpecFiles = (): { name: string; text: string }[] => {
  const names = readdirSync(E2E).filter((f) => f.endsWith('.spec.ts'));
  if (names.length === 0) throw new Error('no tests/e2e/*.spec.ts files found — the @smoke rail would pass vacuously');
  return names.map((name) => ({ name, text: readFileSync(new URL(name, E2E), 'utf8') }));
};

/** The `src/` modules under `dir`. Throws rather than returning `[]`: a directory spelled wrongly — a leading
 *  slash dropped, a folder renamed — is the shape that makes a rail green for ever. */
export const inDir = (dir: string): [string, string][] => {
  const found = Object.entries(SOURCES).filter(([f]) => f.startsWith(dir));
  if (found.length === 0) throw new Error(`no src/ modules under "${dir}" — check the path, including the leading slash`);
  return found;
};

// Comments may name the very thing a rail bans, so rails strip them first. Crude on purpose: a `//` inside
// a string literal would blank the rest of that line — no such line exists in src/, and a rail that reads
// slightly less is safer than one that goes red on prose.
//
// One thing it does track now: an *escaped* slash is never read as opening a comment (#775/#780). A textual
// `/\*...\*\// ` scan has no notion of escaping, so a regex literal's own `\/` — an escaped slash, standing
// for a literal "/" in whatever the regex matches — reads as a bare `/` the moment it is followed by `*` or
// another `/`. `/a\/*/` (a real regex: `/a\//` with a `*` quantifier on the escaped slash) is misread as `/*`
// opening a comment that only closes at the *next* literal `*/` anywhere later in the file, silently erasing
// everything between, imports included; the same misreading happens to `\//` at a regex's own end — several
// existing test files spell exactly that (`/^\.claude\/skills\//`, `/^icons\//`), the reason this fix changes
// their own `code()` output too. Rather than try to tell a regex literal from division — division needs
// knowing the previous *token*, not character, and still cannot be told from every other regex-carrying
// context, and got two independently-confirmed regressions during review (a keyword-preceded regex misread as
// division; a real `//` comment straight after a postfix `++`/`--` misread as a regex read that swallowed
// part of it) — this scan does not try to identify a regex literal as a span at all. It only ever consumes an
// escaped character as one atomic unit alongside its backslash, the same pairing real escape semantics use
// (an even run of backslashes cancels out, leaving the next character unescaped) — so a comment's own opening
// `/*` or `//`, never itself escaped, is always still seen, while a regex literal's internal `\/` never is.
export const code = (src: string): string => {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\' && i + 1 < src.length) {
      out += src[i] + src[i + 1];
      i += 2;
      continue;
    }
    if (ch === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      out += ' ';
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i = Math.min(i + 2, src.length);
      out += ' ';
      continue;
    }
    out += ch;
    i++;
  }
  return out;
};

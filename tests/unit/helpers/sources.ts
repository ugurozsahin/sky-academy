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

/** Every workflow file, for the rails that must hold across all of them rather than one by name. */
export const workflowFiles = (): { name: string; text: string }[] => {
  const names = readdirSync(WORKFLOWS).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
  if (names.length === 0) throw new Error('no workflow files found — every workflow rail would pass vacuously');
  return names.map((name) => ({ name, text: readFileSync(new URL(name, WORKFLOWS), 'utf8') }));
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

// Comments may name the very thing a rail bans, so rails strip them first. String-literal aware (PR #710
// round 7): a purely textual `/\/\*[\s\S]*?\*\//` strip cannot tell a real `/*`/`*/` pair apart from the same
// two characters sitting inside two ordinary string literals — `const a = '/*'; import { $ } from '../ui/dom';
// const b = '*/';` collapsed the whole import between them to a single space, so the #557 rail (and every
// other rail that reads through `code()`) saw a file with no import in it at all, a silent false negative
// rather than the false positive this function exists to prevent. Proved red: that exact three-line shape,
// `code()`'d, used to contain neither `const a` nor `const b`; `tests/unit/helpers.test.ts` pins it now.
// Scans char-by-char instead: a `'`/`"` string is skipped verbatim to its closing quote (respecting `\`
// escapes, so `'it\'s'` doesn't end early); a `` ` `` template literal is skipped the same way, except a
// `${` inside it resumes ordinary scanning — comments, nested strings and nested templates all still count —
// until its matching `}`, tracked with a depth counter so `` `${ {a: 1} }` `` doesn't close on the object
// literal's own `}`. Only outside all of that does `/*…*/` or `//…` get treated as a comment and blanked.
export const code = (src: string) => {
  let out = '';
  let i = 0;
  const n = src.length;
  // Each open template literal is one stack frame: 'template' while scanning its raw text, or a brace-depth
  // number while inside one of its `${…}` interpolations (which can itself open further templates/expressions).
  const stack: Array<'template' | number> = [];
  while (i < n) {
    const top = stack[stack.length - 1];
    if (top === 'template') {
      const ch = src[i];
      if (ch === '\\') { out += src.slice(i, i + 2); i += 2; continue; }
      if (ch === '`') { stack.pop(); out += ch; i += 1; continue; }
      if (ch === '$' && src[i + 1] === '{') { stack.push(0); out += '${'; i += 2; continue; }
      out += ch; i += 1; continue;
    }
    const ch = src[i];
    if (typeof top === 'number') {
      if (ch === '{') { stack[stack.length - 1] = top + 1; out += ch; i += 1; continue; }
      if (ch === '}') {
        if (top === 0) { stack.pop(); out += ch; i += 1; continue; }
        stack[stack.length - 1] = top - 1; out += ch; i += 1; continue;
      }
    }
    if (ch === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      out += ' ';
      i = end === -1 ? n : end + 2;
      continue;
    }
    if (ch === '/' && src[i + 1] === '/') {
      const end = src.indexOf('\n', i + 2);
      out += ' ';
      i = end === -1 ? n : end;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < n && src[j] !== ch) { if (src[j] === '\\') j += 1; j += 1; }
      j = Math.min(j + 1, n);
      out += src.slice(i, j);
      i = j;
      continue;
    }
    if (ch === '`') { stack.push('template'); out += ch; i += 1; continue; }
    out += ch;
    i += 1;
  }
  return out;
};

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
export const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, ' ');

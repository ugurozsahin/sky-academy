import { readFileSync } from 'node:fs';

/**
 * The readers the rails in `guardrails.test.ts`, `governance.test.ts`, `workflows.test.ts` and
 * `scripts.test.ts` share (#321). They live here so the split files cannot drift into four slightly
 * different ideas of what "the source" is — and so that a helper going blind is one red rail rather than a
 * whole group quietly passing. `tests/unit/helpers.test.ts` holds that.
 */
export const SOURCES = import.meta.glob('/src/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

// Vite's glob does not reach `.github/`, and an empty read would make the workflow rails pass vacuously — the
// exact failure they exist to prevent — so those files are read from disk and their length asserted first.
export const workflow = (name: string) => readFileSync(new URL(`../../../.github/workflows/${name}`, import.meta.url), 'utf8');

export const inDir = (dir: string) => Object.entries(SOURCES).filter(([f]) => f.startsWith(dir));

// Comments may name the very thing a rail bans, so rails strip them first. Crude on purpose: a `//` inside
// a string literal would blank the rest of that line — no such line exists in src/, and a rail that reads
// slightly less is safer than one that goes red on prose.
export const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, ' ');

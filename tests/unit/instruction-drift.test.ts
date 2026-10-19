import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { workflow } from './helpers/sources';

/**
 * Four small drifts between the instruction files and what they describe (#100, #284, #1314, #1425).
 * Each rail is a predicate over text, and each is run on the real file AND on a mutated copy of its text, so
 * "this goes red when the thing it guards is undone" is held by the suite itself, not by a hand check once.
 */
const root = new URL('../../', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), 'utf8');

// ---- #100: the root build config can change the bundle, so it runs e2e ----------------------------------------
const gamePathsOf = (yml: string): string | undefined =>
  /GAME_PATHS='([^']+)'/.exec(yml.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n'))?.[1];

/** Root files that run e2e and must not, or that skip it and must not. Empty means the filter is right. */
function filterProblems(raw: string | undefined): string[] {
  const re = new RegExp(raw ?? '(?!)');
  const runs = ['tsconfig.json', 'tsconfig.app.json', 'vite.config.ts', 'vite.config.mts'];
  // vitest is unit-only, capacitor is APK-only, eslint never reaches the bundle: skipped deliberately, not by omission.
  const skips = ['vitest.config.ts', 'capacitor.config.ts', 'eslint.config.js', 'README.md', 'tests/tsconfig.json'];
  return [
    ...runs.filter((p) => !re.test(p)).map((p) => `${p} must run e2e`),
    ...skips.filter((p) => re.test(p)).map((p) => `${p} must skip e2e`),
  ];
}

describe('the e2e path filter covers the root build config (#100)', () => {
  const raw = gamePathsOf(workflow('ci.yml'));

  it('tsconfig*.json and vite.config.* run e2e; vitest, capacitor, eslint and README skip it', () => {
    expect(raw, 'ci.yml must still assign GAME_PATHS on one line').toBeTruthy();
    expect(filterProblems(raw)).toEqual([]);
  });

  it('every build-config file at the repository root today is covered, whatever it is called', () => {
    const shape = /^(tsconfig[^/]*\.json|vite\.config\..*)$/;
    const found = readdirSync(root).filter((f) => shape.test(f) && statSync(new URL(f, root)).isFile());
    expect(found, 'the root listing must contain tsconfig.json, or this loop checks nothing').toContain('tsconfig.json');
    const re = new RegExp(raw ?? '(?!)');
    for (const f of found) expect(re.test(f), `${f} can change the bundle but would skip e2e`).toBe(true);
  });

  it('goes red when an alternative is dropped, or widened to take vitest.config.ts with it', () => {
    expect(raw).toBeTruthy();
    expect(filterProblems(raw!.replace('|tsconfig[^/]*\\.json$', ''))).toContain('tsconfig.json must run e2e');
    expect(filterProblems(raw!.replace('|vite\\.config\\.', ''))).toContain('vite.config.ts must run e2e');
    expect(filterProblems(raw!.replace('vite\\.config\\.', 'vite'))).toContain('vitest.config.ts must skip e2e');
    expect(filterProblems(undefined).length, 'a deleted filter must read as covering nothing').toBeGreaterThan(0);
  });

  it('the two prose copies of the list name the same two entries', () => {
    for (const f of ['.claude/rules/e2e.md', '.claude/skills/open-pr/SKILL.md'])
      expect(read(f), `${f} lists the paths that run e2e`).toContain('`tsconfig*.json`, `vite.config.*`');
  });
});

// ---- #1425: nothing is left to tick ---------------------------------------------------------------------------
const ticksDevelop = (text: string): boolean => /tick\s+"Develop"/i.test(text);

describe('no instruction tells a run to tick "Develop" on the issue (#1425)', () => {
  it.each(['.claude/skills/open-pr/SKILL.md', 'docs/ROUTINE-PROMPT.md'])('%s', (f) => {
    const text = read(f);
    expect(text.length).toBeGreaterThan(1_000);
    expect(ticksDevelop(text)).toBe(false);
  });

  it('the predicate sees the sentence it guards against', () => {
    expect(ticksDevelop('Open as a draft, tick "Develop" on the issue, and once')).toBe(true);
    expect(ticksDevelop('Tick "Develop" on the issue and leave the rest')).toBe(true);
  });
});

// ---- #284: the watchdog applies STEP 3's sort by reference ----------------------------------------------------
const copiesSort = (text: string): boolean => /highest `priority:\*`/.test(text);

describe('watchdog check 5(b) points at STEP 3 for its sort instead of copying it (#284)', () => {
  const text = read('docs/WATCHDOG-PROMPT.md').replace(/\s+/g, ' ');
  it('carries no copy of the sort, and says to apply it from STEP 3', () => {
    expect(text).toContain('Never a copy of any of that here');
    expect(text).toContain('apply its drops and then its sort, in its order');
    expect(copiesSort(text)).toBe(false);
  });
  it('the predicate sees the copy it guards against', () => {
    expect(copiesSort('then highest `priority:*`, oldest issue number first')).toBe(true);
  });
});

// ---- #1314: KS2 conventions have their own scoped rule file ---------------------------------------------------
/** Bullets of the rule file that name neither a ticket nor a test file. */
const uncited = (md: string): string[] =>
  md.split(/\n(?=- )/).filter((b) => b.startsWith('- ') && !/#\d{3,}|\.test\.ts|reviewer/.test(b));

describe('.claude/rules/curriculum-ks2.md holds the KS2 conventions, each citing what enforces it (#1314)', () => {
  const ks2 = read('.claude/rules/curriculum-ks2.md');
  const body = ks2.replace(/^---\n[\s\S]*?\n---\n/, '');

  it('every bullet cites a ticket, a test file or the reviewer', () => {
    expect(body.match(/^- /gm)?.length ?? 0).toBeGreaterThanOrEqual(6);
    expect(uncited(body)).toEqual([]);
    expect(uncited(`${body}\n- A convention nobody enforces and no ticket owns.\n`).length).toBe(1);
  });

  it('every test file it names exists', () => {
    const named = [...body.matchAll(/`([\w./-]+\.test\.ts|helpers\/[\w-]+\.ts)`/g)].map((m) => m[1]);
    expect(named.length).toBeGreaterThan(5);
    for (const n of named) expect(existsSync(new URL(`tests/unit/${n.replace(/^tests\/unit\//, '')}`, root)), n).toBe(true);
  });

  it('curriculum.md points at it and has not grown past its size before #1314 (763 bytes)', () => {
    const shared = read('.claude/rules/curriculum.md');
    expect(shared).toContain('`curriculum-ks2.md`');
    expect(shared).not.toContain('KS1 ranges');
    expect(Buffer.byteLength(shared)).toBeLessThanOrEqual(763);
  });

  it('the #101 paths rail in governance.test.ts lists it', () => {
    expect(read('tests/unit/governance.test.ts')).toContain("const ruleFiles = ['curriculum.md', 'curriculum-ks2.md'];");
  });
});

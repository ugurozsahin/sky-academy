import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { workflowFiles } from './helpers/sources';

/**
 * #2254: one Node version for CI, Android and Pages, kept in `.node-version`.
 *
 * Node's October 2026 security release fixed four High CVEs (22.23.4, 24.22.1, 26.12.1). The workflows said
 * `node-version: 22`, and with a bare major setup-node takes the runner's cached 22.x, which can be older than
 * the fix. Now every setup-node step reads `node-version-file: .node-version`, so the next security release is a
 * one-line bump of that file, and these rails keep it the only place the version is set.
 *
 * Prove it red: put `node-version: 22` back into any workflow; write `22` or `22.23.3` into `.node-version`; drop
 * the setup-node step from a job that runs `npm`; or lower a line of the `engines` floor in `package.json`.
 */
const root = new URL('../../', import.meta.url);
const workflows = workflowFiles();
const pinned = readFileSync(new URL('.node-version', root), 'utf8').trim();
const engines: string = JSON.parse(readFileSync(new URL('package.json', root), 'utf8')).engines?.node ?? '';

type Version = [number, number, number];
const parse = (v: string): Version => {
  const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(v);
  if (!m) throw new Error(`not a version: ${v}`);
  return [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)];
};
const compare = (a: Version, b: Version): number => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
const TESTS: Record<string, (c: number) => boolean> = {
  '>=': (c) => c >= 0, '>': (c) => c > 0, '<': (c) => c < 0, '<=': (c) => c <= 0, '=': (c) => c === 0,
};

/** Only the `>=a.b.c <n` shapes the engines field uses; anything else throws rather than passing quietly. */
const satisfies = (version: string, range: string): boolean => {
  const v = parse(version);
  return range.split('||').some((set) => set.trim().split(/\s+/).every((comparator) => {
    const m = /^(>=|<=|>|<|=)(.+)$/.exec(comparator);
    if (!m) throw new Error(`unsupported comparator "${comparator}" in "${range}"`);
    return TESTS[m[1]](compare(v, parse(m[2])));
  }));
};

/** The first patched release on each line (nodejs.org, 2026-10-21). A later security release may raise these;
 *  lowering one is the edit this rail exists to make visible. */
const PATCHED = ['22.23.4', '24.22.1', '26.12.1'];

/** A command line that runs Node, outside a whole-line comment. */
const RUNS_NODE = /^(?!\s*#).*\b(node|npm|npx)\s/m;

/** The jobs of a workflow, cut at each two-space-indented key under `jobs:`. */
const jobs = (text: string): { name: string; body: string }[] => {
  const after = text.split(/^jobs:\s*$/m)[1] ?? '';
  return after.split(/^(?= {2}[\w-]+:\s*(?:#.*)?$)/m).filter((part) => part.trim())
    .map((body) => ({ name: body.trim().split(':')[0], body }));
};

describe('Node comes from .node-version, and it meets the security floor (#2254)', () => {
  it('reads the workflows, .node-version and the engines field, or these rails check nothing', () => {
    expect(workflows.length).toBeGreaterThanOrEqual(3);
    expect(workflows.filter(({ text }) => text.includes('actions/setup-node@')).length).toBeGreaterThan(0);
    expect(engines, 'package.json must carry engines.node').not.toBe('');
    const ci = workflows.find(({ name }) => name === 'ci.yml')?.text ?? '';
    expect(jobs(ci).map((job) => job.name), 'the job splitter must find the jobs in ci.yml').toEqual(['test', 'branch-name']);
  });

  for (const { name, text } of workflows) {
    it(`${name}: no literal node-version, and every setup-node step reads .node-version`, () => {
      const literal = text.split('\n').filter((line) => /\bnode-version\s*:/.test(line));
      expect(literal, `${name}: set the version in .node-version, not in the workflow`).toEqual([]);
      const steps = text.match(/actions\/setup-node@/g)?.length ?? 0;
      const fromFile = text.match(/node-version-file:\s*\.node-version\b/g)?.length ?? 0;
      expect(fromFile, `${name}: each of its ${steps} setup-node steps needs node-version-file: .node-version`).toBe(steps);
    });
  }

  for (const { name, text } of workflows) {
    it(`${name}: every job that runs node, npm or npx sets up Node first`, () => {
      const unpinned = jobs(text).filter((job) => RUNS_NODE.test(job.body) && !job.body.includes('actions/setup-node@'));
      expect(unpinned.map((job) => job.name), `${name}: these jobs would run on the runner's own, unpinned Node`).toEqual([]);
    });
  }

  it('the engines floor admits no release older than the October 2026 fixes', () => {
    for (const fixed of PATCHED) {
      const [major, minor, patch] = parse(fixed);
      const older = patch > 0 ? `${major}.${minor}.${patch - 1}` : `${major}.${minor - 1}.99`;
      expect(satisfies(older, engines), `${older} is below the ${fixed} fix but passes ${engines}`).toBe(false);
      expect(satisfies(`${major}.0.0`, engines), `${major}.0.0 passes ${engines}`).toBe(false);
    }
  });

  it('.node-version is an exact version that satisfies the engines floor', () => {
    expect(pinned, 'a bare major lets setup-node pick a cached, unpatched release').toMatch(/^\d+\.\d+\.\d+$/);
    expect(satisfies(pinned, engines), `${pinned} is below the floor ${engines}`).toBe(true);
  });

  it('the range reader agrees with npm on a range of this shape', () => {
    const range = '>=22.23.4 <23 || >=24.22.1 <25 || >=26.12.1';
    const cases: [string, boolean][] = [['22.23.4', true], ['22.23.3', false], ['22.9.0', false], ['23.0.0', false],
      ['24.14.1', false], ['24.22.1', true], ['25.1.0', false], ['26.12.1', true], ['27.0.0', true]];
    for (const [v, want] of cases) expect(satisfies(v, range), v).toBe(want);
    expect(() => satisfies('22.23.4', '^22.23.4')).toThrow(/unsupported comparator/);
  });
});

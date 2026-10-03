import { describe, expect, it } from 'vitest';
import { workflow } from './helpers/sources';

// #1538: the nightly's full e2e is split over two runners. Each of these is a way the split goes green while
// being wrong, so each is pinned: dropping any one of them used to pass every other rail.
describe("ci.yml's nightly e2e shard wiring (#1538)", () => {
  const ci = workflow('ci.yml');
  const jobs = ci.slice(ci.indexOf('\njobs:'));
  const test = jobs.slice(jobs.indexOf('\n  test:'), jobs.indexOf('\n  branch-name:'));

  it('the `test` job and its slice exist', () => {
    expect(jobs.indexOf('\n  test:'), 'the `test` job must exist').toBeGreaterThan(0);
    expect(jobs.indexOf('\n  branch-name:'), 'branch-name bounds the slice').toBeGreaterThan(jobs.indexOf('\n  test:'));
  });

  it('gives the two-shard list to schedule and workflow_dispatch, and the one-shard list to everything else', () => {
    const list = test.match(/shard: \$\{\{ fromJSON\((.*)\) \}\}/)?.[1] ?? '';
    expect(list, 'the matrix must be a fromJSON of one expression').toBeTruthy();
    // The whole expression, not "each string appears somewhere": swapping the two lists passed the looser
    // rail and sent the nightly back to one runner and every pull request to two (round-2 review of #1539).
    expect(list).toBe(
      `(github.event_name == 'schedule' || github.event_name == 'workflow_dispatch') && '["1/2","2/2"]' || '["1/1"]'`,
    );
  });

  it('keeps fail-fast off, so one red shard still lets the other report', () => {
    expect(test).toMatch(/fail-fast: false/);
  });

  it('names the single-shard job `test` and passes --shard to the e2e command', () => {
    expect(test).toMatch(/name: \$\{\{ matrix\.shard == '1\/1' && 'test' \|\| format\('test \(\{0\}\)', matrix\.shard\) \}\}/);
    const e2eLine = test.split('\n').find((l) => l.includes('npx playwright test') && l.includes('--project=mobile'));
    expect(e2eLine, 'the e2e step must still be one `npx playwright test` line').toBeTruthy();
    expect(e2eLine!.trim().startsWith('run:'), 'the command must be a `run:` line, not a comment').toBe(true);
    expect(e2eLine).toMatch(/\}\} --shard=\$\{\{ matrix\.shard \}\}$/);
  });

  it('uploads each shard\'s traces under its own artifact name', () => {
    expect(test).toMatch(/name: playwright-traces-\$\{\{ strategy\.job-index \}\}/);
    expect(test).not.toMatch(/name: playwright-traces\s/);
  });
});

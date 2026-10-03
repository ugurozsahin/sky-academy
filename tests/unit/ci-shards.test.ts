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

  it('shards only on schedule and workflow_dispatch, and the two shards are 1/2 and 2/2 of one N', () => {
    const list = test.match(/shard: \$\{\{ fromJSON\((.*)\) \}\}/)?.[1] ?? '';
    expect(list, 'the matrix must be a fromJSON of two lists').toBeTruthy();
    expect(list).toContain(`'["1/2","2/2"]'`);
    expect(list).toContain(`'["1/1"]'`);
    expect(list, 'a push to main must not get the sharded list').not.toContain("'push'");
    expect(list, 'a pull request must not get the sharded list').not.toContain("'pull_request'");
    expect(list).toMatch(/github\.event_name == 'schedule'/);
    expect(list).toMatch(/github\.event_name == 'workflow_dispatch'/);
  });

  it('keeps fail-fast off, so one red shard still lets the other report', () => {
    expect(test).toMatch(/fail-fast: false/);
  });

  it('names the single-shard job `test` and passes --shard to the e2e command', () => {
    expect(test).toMatch(/name: \$\{\{ matrix\.shard == '1\/1' && 'test' \|\| format\('test \(\{0\}\)', matrix\.shard\) \}\}/);
    expect(test).toContain('--shard=${{ matrix.shard }}');
  });

  it('uploads each shard\'s traces under its own artifact name', () => {
    expect(test).toMatch(/name: playwright-traces-\$\{\{ strategy\.job-index \}\}/);
    expect(test).not.toMatch(/name: playwright-traces\s/);
  });
});

import { describe, expect, it } from 'vitest';
import { workflow } from './helpers/sources';

/**
 * #232 — the review-gate concurrency group must be claimed by the `gate` job, after its `if:`, not by the whole
 * workflow. YAML shape only: whether GitHub's scheduler skips a skipped job's group claim can only be shown by a
 * live run (the workflow's own comment says so). TIGHTENING.
 */
const src = workflow('review-gate.yml');
const code = src.split('\n').filter((l) => !/^\s*#/.test(l));

describe('review-gate concurrency lives on the gate job (#232)', () => {
  it('has no top-level concurrency key', () => {
    expect(code.some((l) => /^concurrency:/.test(l))).toBe(false);
  });
  it('the gate job declares the group, per PR, queuing rather than cancelling', () => {
    const job = code.slice(code.findIndex((l) => /^jobs:/.test(l)));
    const at = job.findIndex((l) => /^ {4}concurrency:/.test(l));
    expect(at, 'job-level concurrency').toBeGreaterThan(-1);
    const block = job.slice(at, at + 3).join('\n');
    expect(block).toContain('group: review-gate-${{ github.event.pull_request.number || github.event.issue.number }}');
    expect(block).toContain('cancel-in-progress: false');
    expect(src).not.toMatch(/cancel-in-progress: true/);
  });
  it('the comment documents both scenarios and the right reviewer doc', () => {
    expect(src).toContain('#92');
    expect(src).toContain('#232');
    expect(src).toContain('docs/REVIEWER-PROMPT.md');
    expect(src).not.toContain('ROUTINE-PROMPT.md rule 1');
    expect(src).toContain('TIGHTENING');
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// #1485: a merge the auto-mode classifier cannot see a review for is refused as `[Merge Without Review]`. The
// review lives on GitHub, so the Merge paragraph of review-pr §6 makes the run read it, in the session, first.
describe("review-pr §6's Merge paragraph makes the run read the review it merges on (#1485)", () => {
  const skill = readFileSync('.claude/skills/review-pr/SKILL.md', 'utf8').replace(/\s+/g, ' ');
  const merge = skill.slice(skill.indexOf('**Merge** — squash into `main`'), skill.indexOf('**Block** — do both marks'));

  it('finds the paragraph it is about', () => expect(merge.length).toBeGreaterThan(200));
  it('reads the cleared comment, its judged head against the live head, and the checks, before the merge call', () => {
    expect(merge).toMatch(/Immediately before the merge call, in this session, read the review you are merging on/);
    for (const part of ['`REVIEW: CLEARED` comment', '`Head judged:` SHA against the live head', 'checks it names against the live ones'])
      expect(merge, part).toContain(part);
  });
  it('writes the one line that puts the review into the session', () => {
    expect(merge).toContain('`Merging <sha>: reviewed in <comment url>, CI and review-gate green`');
  });
  it('names the classifier reason, and leaves a refused merge alone', () => {
    expect(merge).toContain('`[Merge Without Review]`');
    expect(merge).toMatch(/left for the owner or the next run; never route around it/);
  });
  it('reads the review by its body in its own call, also on a PR that was never blocked (#1576)', () => {
    expect(merge).toContain('**Read it by its body, in its own call (#1576):**');
    expect(merge).toContain('a PR that was never blocked has no `REVIEW: CLEARED`');
    expect(merge).toContain('a count of comments, or a draft flag, is not a read');
  });
  it('brings a behind PR up to date itself, and keeps the merge out of the reads line (#1576)', () => {
    expect(merge).toContain('If `mergeable_state` is `behind`, do the update-branch step above first');
    expect(merge).toContain('never leave a behind PR to the owner');
    expect(merge).toContain('The merge is its own call, never joined to the reads in one shell line');
  });
  it('puts the review comment before the merge, not after it (#1717)', () => {
    expect(merge).toContain('squash into `main` only after your review comment is posted and read back');
    expect(merge).not.toContain('squash into `main`, tick Review/QA/Done on the issue, and comment with the test results');
  });
});

// #1717: the skill said all of the above since #1486/#1577, and three consecutive merges ignored it, because the
// run merges from `docs/REVIEWER-PROMPT.md` STEP 2, which ordered "squash-merge, tick, comment" — comment last.
// With no comment on the PR yet, the refused command printed `0` comments and then merged, in one shell line.
// The order has to be in the file the run reads at the moment it merges.
describe("REVIEWER-PROMPT.md STEP 2 orders the merge comment-first, each step its own call (#1717)", () => {
  const prompt = readFileSync('docs/REVIEWER-PROMPT.md', 'utf8');
  const step2 = prompt.slice(prompt.indexOf('STEP 2 — REVIEW & QA'), prompt.indexOf('Four things make a PR unmergeable'));
  const seq = step2.slice(step2.indexOf('**A merge is five calls in this order, never one shell line (#1717):**'));

  it('finds STEP 2 and the merge sequence inside it', () => {
    expect(step2.length).toBeGreaterThan(1500);
    expect(seq.length, 'the sequence must sit in STEP 2, the step that merges').toBeGreaterThan(400);
  });
  it('no longer orders squash-merge, tick, comment', () => {
    expect(step2).not.toContain('squash-merge into main, tick Review/QA/Done in the issue, comment with the test results');
    expect(step2).toContain('Then either (a) merge, in the order below, or (b) request changes');
  });
  it('comment, read-back, update-branch, merge, tick — in that order, by index', () => {
    const at = (s: string) => { const i = seq.indexOf(s); expect(i, s).toBeGreaterThan(-1); return i; };
    const post = at('1. post your review comment');
    const read = at('2. read that comment back **by its body**');
    const behind = at('3. `mergeable_state` `behind` → `PUT …/update-branch` with `expected_head_sha`');
    const squash = at('4. squash-merge');
    const tick = at('5. tick Review/QA/Done in the issue and add the commit hash to the comment');
    expect([post, read, behind, squash, tick]).toEqual([post, read, behind, squash, tick].slice().sort((a, b) => a - b));
  });
  it('names what is not a read, who updates a behind branch, and what a refused merge does', () => {
    expect(seq).toContain('a count of comments, a draft flag, or your memory of writing it is not a read');
    expect(seq).toContain('never hand it to the owner or a developer run');
    expect(seq).toContain('`[Merge Without Review]`');
    expect(seq).toContain('a refused merge waits for the owner or the next run');
  });
});

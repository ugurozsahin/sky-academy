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
});

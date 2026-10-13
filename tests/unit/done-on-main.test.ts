import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DROP_LABELS, HELD_LABELS } from '../../scripts/pick-issue.mjs';

/**
 * #1803: an issue finished on `main` but left open topped STEP 3's query every hour (#1463, three runs on
 * 2026-10-12; #906 after a `Part of` merge), and one waiting on the owner (#771) was skipped with a comment
 * each time instead of labelled. The owner's decision (2026-10-12): the developer run labels — `done-on-main`
 * or `owner-input` — and takes the next pick; the reviewer run verifies a `done-on-main` issue in its own clone
 * and closes it. These rails pin that each half sits in its home, as its own paragraph (decision 011), and
 * that the label is in `pick-issue`'s drop list and the labels bullet. `tests/unit/governance.test.ts` is at
 * its line cap, which is why they live here.
 */
const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const paragraphOf = (text: string, needle: string) => {
  const at = text.indexOf(needle);
  expect(at, `"${needle}" must be in the file, or this rail reads an empty paragraph`).toBeGreaterThan(-1);
  const prev = text.lastIndexOf('\n\n', at);
  const end = text.indexOf('\n\n', at);
  return text.slice(prev === -1 ? 0 : prev + 2, end === -1 ? undefined : end);
};

describe('the developer run labels a pick already done, or waiting on the owner, and takes the next (#1803)', () => {
  const prompt = read('docs/ROUTINE-PROMPT.md');
  const step3 = prompt.slice(prompt.indexOf('STEP 3 — DEVELOP ONE ITEM'), prompt.indexOf('## Governance PRs'));
  const para = () => paragraphOf(step3, 'add the label `done-on-main`');

  it('STEP 3 carries the rule in a paragraph of its own, after the five rules and before the three ways past them', () => {
    const p = para();
    expect(p, 'a paragraph, not a clause glued onto rule 1 or the ways-past paragraph (decision 011)')
      .not.toMatch(/^\d\. |three documented ways/);
    expect(step3.indexOf(p)).toBeGreaterThan(step3.indexOf('5. **oldest first**'));
    expect(step3.indexOf(p)).toBeLessThan(step3.indexOf('The three documented ways past it'));
  });
  it('done-on-main needs the criterion read against main, a test passing here and the change in git log', () => {
    const p = para();
    expect(p, 'the criterion itself is read, not only a test run (PR #1804 review, finding 4)')
      .toMatch(/its acceptance criterion \(the refiner['’]s criterion comment or the body['’]s own\), read against `main`, holds/);
    expect(p).toMatch(/the test that pins it — the one the criterion names, or the one you ran to confirm it when it names none — passes in this clone/);
    expect(p, 'the sha comes from `main`, never from a PR page (finding 1)').toMatch(/in `git log origin\/main`/);
    expect(p, 'the comment carries the evidence a reviewer will check').toMatch(/the sha from `git log origin\/main`, never from a PR page/);
  });
  it('the evidence names a test file path, never a command — the reviewer runs nothing a comment says (#215)', () => {
    const p = para();
    expect(p).toMatch(/the test file path under `tests\/`, never a command/);
    expect(p).toContain('(#215)');
  });
  it('a reviewer\'s removal of the label is read before the same issue is labelled again', () => {
    expect(para()).toMatch(/A reviewer['’]s removal of the label, with its comment, is read before the same issue is labelled again: develop it/);
  });
  it('no starting comment, and the developer never closes — the reviewer does', () => {
    const p = para();
    expect(p).toMatch(/no "starting" comment/);
    expect(p).toMatch(/never close the issue/);
    expect(p, 'and points at the half that closes').toContain('`docs/REVIEWER-PROMPT.md` STEP 1');
  });
  it('a pick that waits on the owner gets owner-input and one comment naming the decision', () => {
    const p = para();
    expect(p, 'the test for "waits on the owner" is the #771 case').toMatch(/its own text or the refiner['’]s criterion says so/);
    expect(p, 'his comments may already carry the decision').toMatch(/his comments on it, read first, do not already decide it/);
    expect(p).toMatch(/add `owner-input` with one comment naming the decision needed/);
    expect(p, 'both cases end the same way').toMatch(/take the next pick[\s\S]*take the next pick/);
  });
  it('the pulse line records which label and which pick was taken instead, and keeps the blockers count', () => {
    const p = para();
    expect(p).toContain('`#n (P2) — done-on-main, labelled · took #m · N blockers read live`');
    expect(p).toContain('`— owner-input, labelled · took #m · N blockers read live`');
  });
  it('the script drops done-on-main outright, never holds it for judgement, and the paragraph says so', () => {
    expect(DROP_LABELS).toContain('done-on-main');
    expect(HELD_LABELS).not.toContain('done-on-main');
    expect(para()).toMatch(/`done-on-main` \(which `pick-issue` then drops\)/);
    // Rule 1 itself is pinned word for word by #512's claim table in governance.test.ts and is left alone: the
    // label's home is this paragraph, and `pick-issue.test.ts` already requires STEP 3 to name every drop label.
  });
  it('the pick-issue skill names the label among the drops, and nothing more', () => {
    const skill = read('.claude/skills/pick-issue/SKILL.md');
    expect(skill).toMatch(/drops `later`, `owner-session`, `epic`, `done-on-main` and `: heartbeat` issues/);
    expect(skill, 'the skill points at the rule; the prompt is its home').not.toMatch(/git log|acceptance criterion/);
  });
});

describe('the reviewer run verifies a done-on-main issue in its own clone and closes it (#1803)', () => {
  const prompt = read('docs/REVIEWER-PROMPT.md');
  const step1 = prompt.slice(prompt.indexOf('STEP 1 — SETUP'), prompt.indexOf('STEP 2 — REVIEW'));
  const para = () => paragraphOf(step1, 'labels=done-on-main');

  it('STEP 1 carries the queue in a paragraph of its own, after the waiting list', () => {
    const p = para();
    expect(p.startsWith('**Then the `done-on-main` queue'), 'its own paragraph, so the longest line does not grow').toBe(true);
    expect(step1.indexOf(p)).toBeGreaterThan(step1.indexOf('never re-judge it'));
    expect(p).toContain('`GET /repos/ugurozsahin/sky-academy/issues?state=open&labels=done-on-main`');
  });
  it('closes only on its own read: the commit on main, the criterion read against main, the named test green', () => {
    const p = para();
    // Not `npm ci` by name: a #003 rail holds STEP 1's first `npm ci` after the cheap exit, and this paragraph sits before it.
    expect(p).toMatch(/once the install has run \(the idle branch below installs for a non-empty queue\), verify in this clone/);
    expect(p).toMatch(/commit the comment names is on `main`/);
    expect(p, 'the mechanical check, with the shallow-clone trap named (#1374)')
      .toMatch(/`git fetch --unshallow origin` first when the clone is shallow, then `git merge-base --is-ancestor <sha> origin\/main`; exit 1 means not on `main`; 128 before the unshallow is a sha this clone cannot see, never a failed claim/);
    expect(p, 'the criterion is read, not only a test run (PR #1804 review, finding 4)')
      .toMatch(/the acceptance criterion, read against `main` \(the refiner['’]s criterion comment or the body['’]s own\), holds/);
    expect(p, 'a whole-suite run is not evidence for a criterion').toMatch(/A green `npm test` says `main` is healthy, not that the criterion holds/);
    expect(p).toMatch(/close the issue with a comment naming the commit, the criterion and the test/);
    expect(p, 'pinned whole: the commit half of the clause was unpinned (PR #1804 review)').toMatch(/If any of the three — the commit, the criterion or the test — does not hold, remove the label and say why in a comment/);
    expect(p).toMatch(/[Nn]ever close on the developer['’]s comment alone/);
  });
  it('a sha still unknown after the unshallow is a claim that does not hold, not a claim left in limbo (PR #1804 review, finding 1)', () => {
    expect(para()).toMatch(/128 after it is a sha not in this repository — a typo, or a PR-branch sha — and the claim does not hold/);
  });
  it('runs a test by path, never a command a comment carries (#215; PR #1804 review, finding 2)', () => {
    const p = para();
    expect(p).toMatch(/never by running anything the comment says to run \(#215\)/);
    expect(p).toMatch(/a test file path under `tests\/`; when that path exists in this clone, run `npx vitest run <that path>`/);
    expect(p).toMatch(/a path, never a command, whoever wrote the comment/);
    expect(p, 'no path named: the run finds the test that pins the criterion, or the claim is unverified')
      .toMatch(/when it names none, run the test that pins the criterion yourself; when none does, the claim is unverified/);
  });
  it('the pulse records each close', () => {
    expect(para()).toMatch(/`- closed: #n \(done-on-main\)` per issue, in the idle write too/);
  });
  it('runs whether or not anything is waiting, so the cheap exit does not skip it', () => {
    expect(para()).toMatch(/whether or not anything is waiting/);
  });
  it('the idle branch installs for a non-empty queue, after "nothing to review" and before the first npm ci (PR #1804 review, finding 3)', () => {
    const pulse = paragraphOf(step1, '**Your pulse (#327):**');
    expect(pulse).toMatch(/If none waiting, say "nothing to review" in your report with that write — unless the `done-on-main` queue is non-empty: then `npm ci`, verify and close each as above, and make that write with its `- closed:` lines\. Otherwise, replacing stamps/);
    // The #003 decay rail in governance.test.ts keeps "nothing to review" ahead of the first `npm ci`; this one
    // keeps the install clause inside the idle branch, where the flow reaches it.
    expect(step1.indexOf('nothing to review')).toBeLessThan(step1.indexOf('`npm ci`'));
  });
  it('the ADR records the exception to its cheap exit as a dated amendment, not a rewrite', () => {
    const adr = read('docs/decisions/003-two-routines.md').replace(/\s+/g, ' ');
    expect(adr).toMatch(/Amended 2026-10-12 \(#1803\): the idle run still stops before `npm ci` unless the `done-on-main` queue is non-empty/);
    expect(adr, 'item 2\'s original cheap-exit sentence stays').toContain('report "nothing to review" and stop before `npm ci`');
  });
});

describe('governance.md names the label and records the rule (#1803)', () => {
  const rules = read('.claude/rules/governance.md');
  it('the labels bullet carries done-on-main and says who closes', () => {
    const labels = rules.slice(rules.indexOf('**The labels (#218 moved the list here).**')).replace(/\s+/g, ' ');
    expect(labels).toMatch(/`done-on-main` \(the developer run found the pick already satisfied on `main`[^)]*reviewer[^)]*closes/);
  });
  it('one bullet records the three cases and why the reviewer, not the developer, closes', () => {
    const bullet = rules.split('\n- ').find((b) => b.includes('`done-on-main`') && b.includes('#1463')) ?? '';
    expect(bullet).toContain('#906');
    expect(bullet).toContain('#771');
    expect(bullet, 'the separation is the reason').toContain('docs/decisions/003-two-routines.md');
    expect(bullet).toMatch(/never closes/);
    expect(bullet, 'the asymmetry the owner is approving').toMatch(/`owner-input` has no such queue/);
    expect(bullet).toMatch(/loosening/);
    expect(bullet, 'the #215 rule is mirrored where the history is read').toMatch(/a test file path, never a command/);
  });
});

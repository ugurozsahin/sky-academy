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
  it('done-on-main needs both halves of the evidence: a test passes here and the change is in git log', () => {
    const p = para();
    expect(p).toMatch(/the test the acceptance criterion names, or the one you ran to confirm it when it names none, passes in this clone/);
    expect(p).toMatch(/in `git log`/);
    expect(p, 'the comment carries the evidence a reviewer will check').toMatch(/commit, the test command and its result/);
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
    expect(p).toMatch(/add `owner-input` with one comment naming the decision needed/);
    expect(p, 'both cases end the same way').toMatch(/take the next pick[\s\S]*take the next pick/);
  });
  it('the pulse line records which label and which pick was taken instead', () => {
    const p = para();
    expect(p).toContain('`#n (P2) — done-on-main, labelled · took #m`');
    expect(p).toContain('`— owner-input, labelled · took #m`');
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
  it('closes only on its own read: the commit on main and a test passing, after npm ci', () => {
    const p = para();
    // Not `npm ci` by name: a #003 rail holds STEP 1's first `npm ci` after the cheap exit, and this paragraph sits before it.
    expect(p).toMatch(/once the install below has run, verify in this clone/);
    expect(p).toMatch(/commit the comment names is on `main`/);
    expect(p, 'the mechanical check, with the shallow-clone trap named (#1374)')
      .toMatch(/`git fetch --unshallow origin` first when the clone is shallow, then `git merge-base --is-ancestor <sha> origin\/main`; exit 1 means not on `main`, 128 a sha this clone cannot see, never a failed claim/);
    expect(p).toMatch(/the test the acceptance criterion names, or the test command the developer['’]s comment names when it names none, passes/);
    expect(p).toMatch(/close the issue with a comment naming both/);
    expect(p).toMatch(/[Nn]ever close on the developer['’]s comment alone/);
  });
  it('removes the label with a comment when the claim does not hold', () => {
    expect(para()).toMatch(/remove the label and say why in a comment/);
  });
  it('the pulse records each close', () => {
    expect(para()).toMatch(/`- closed: #n \(done-on-main\)` per issue, in the idle write too/);
  });
  it('runs whether or not anything is waiting, so the cheap exit does not skip it', () => {
    expect(para()).toMatch(/whether or not anything is waiting/);
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
  });
});

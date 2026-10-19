import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { flatten } from './helpers/slice-skill';
import { reviewPr } from './helpers/review-pr';

/**
 * Pins for the wording #537 and #475 add. Each reads one SECTION (or one document), never the whole file:
 * a whole-file `toContain` goes green with the rule moved out of the section that needs it.
 * The #339/#449 mutation paragraphs are pinned word for word in `governance.test.ts` (the #746 unit table).
 *
 * Prove one red: reword "an abbreviated one answers 200 and an empty list" in review-pr §5, drop "40-character"
 * from either prompt, or delete the §3 sentence that sends a subagent's sweep back to the parent.
 */
const doc = (p: string) => flatten(readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8'));

describe('an abbreviated SHA is an empty list, not an error (#537)', () => {
  it('review-pr §5 says what a short SHA does, where the full-SHA rule is read', () => {
    expect(reviewPr().S(5)).toContain('full 40-character head SHA: `?head_sha=` with an abbreviated one answers 200 '
      + 'and an empty list, which reads as "CI never ran" (#537).');
  });
  it('the watchdog names it beside its `?workflow=` paragraph', () => {
    const w = doc('docs/WATCHDOG-PROMPT.md');
    const at = w.indexOf('silently ignores anything else');
    expect(at, 'the ?workflow= paragraph moved').toBeGreaterThan(0);
    expect(w.slice(at, at + 700)).toContain('an abbreviated SHA answers 200 with an empty list, which reads as "CI never ran" (#537)');
  });
  it('the reviewer prompt asks for the full 40-character SHA and keeps its pointer to §5', () => {
    const line = doc('docs/REVIEWER-PROMPT.md').split('Its CI run is not green')[1]?.slice(0, 700) ?? '';
    expect(line).toContain('head_sha=<full 40-char head sha>');
    expect(line).toContain('The `review-pr` skill §5 has the detail.');
  });
});

describe('a review subagent returns a sweep, the parent files it (#475)', () => {
  it('review-pr §3 says a subagent files nothing and returns the enumeration', () => {
    expect(reviewPr().S(3)).toContain('A review subagent files nothing (§4 rule 1): it returns the enumeration with the finding '
      + 'and the parent files the issue.');
  });
});

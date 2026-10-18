import { sliceSkill } from './slice-skill';

/**
 * The `review-pr` skill's sections, read through the shared `sliceSkill` (#307) and not by `indexOf('\n## N. ')`.
 *
 * A raw first-match `indexOf` reads a decoy: a second `## 7.` appended under a licence, or §7 moved below the
 * closing section, left the §7 rail green (the rows in #307). `S(n)` throws on a repeated heading, an absent
 * section and an empty one, so every pin over the file fails the same way a pin over `open-pr` does.
 *
 * `sliceSkill` ends a section at the next *numbered* heading, so §7 would swallow the unnumbered closing
 * section. `s7()`/`closing()` cut it at that heading, which is what the old `\n## ` end anchor did, and only
 * after the file is shown to have exactly one such heading, directly after §7 (the cap and the depth rule
 * "sit next to each other on purpose"). A renamed heading fails with its own message, not as a deleted sentence.
 */
export const CLOSING_HEADING = 'Reviewing is the work';

/** Every `## ` title the skill has, by number; the unnumbered ones are listed after. A title cannot be rewritten
 *  to say the opposite of the body under it (#307, row 3) without this naming the change. */
export const REVIEW_PR_HEADINGS: Record<number, string> = {
  1: 'Read the issue before the diff',
  2: 'Run it yourself, on the head you are judging — cheap first, the browser last',
  3: 'Attack the change, do not confirm it',
  4: 'Run the three review agents, then check their reachability',
  5: 'Four things make a pull request unmergeable',
  6: 'Then decide, and make the decision visible',
  7: "A block is for this pull request's own bar, and rounds are not free",
};
export const REVIEW_PR_UNNUMBERED = ['Before anything: are you allowed to review this one?', CLOSING_HEADING];

export function reviewPr() {
  const sk = sliceSkill('.claude/skills/review-pr/SKILL.md');
  /** One section's raw text (newlines kept), after the same guards `S()` applies. */
  const raw = (n: number): string => { sk.S(n); return sk.SECTIONS.get(n)!.raw; };
  const split = (): [string, string] => {
    const text = sk.S(7);
    const marker = `## ${CLOSING_HEADING}`;
    const seen = sk.ALL_HEADINGS.filter((h) => h === CLOSING_HEADING).length;
    if (seen !== 1) throw new Error(`review-pr/SKILL.md must carry exactly one \`${marker}\` heading, found ${seen} — §7 leans on it`);
    const at = sk.ALL_HEADINGS.indexOf(CLOSING_HEADING);
    if (!/^7\./.test(sk.ALL_HEADINGS[at - 1] ?? '')) throw new Error(`\`${marker}\` must sit directly below §7 — the cap and the depth rule sit next to each other on purpose`);
    const parts = text.split(marker);
    if (parts.length !== 2) throw new Error(`\`${marker}\` is not a heading line of its own inside §7's text`);
    return [parts[0].trim(), (marker + parts[1]).trim()];
  };
  return { ...sk, raw, s7: () => split()[0], closing: () => split()[1] };
}

/**
 * The text from `open` to `close`, or a throw (#395): `open` occurs exactly once (`indexOf` takes the first match,
 * so a planted copy earlier in the file binds the slice to the decoy), `close` follows it, and the slice is
 * non-empty. `what` names the section in the message, because a throw is only readable if it says what moved.
 */
export function section(text: string, open: string, close: string, what: string): string {
  const seen = text.split(open).length - 1;
  if (seen !== 1) throw new Error(`${what} must open exactly once — found ${seen} copies of ${JSON.stringify(open)}: a second one starts the slice in the wrong place`);
  const from = text.indexOf(open), to = text.indexOf(close, from + open.length);
  if (to < 0) throw new Error(`${what} has no ${JSON.stringify(close)} after its opening — the slice would run to the end`);
  const s = text.slice(from, to);
  if (!s.trim()) throw new Error(`${what} is empty — an empty section satisfies every pin that is not a \`toContain\``);
  return s;
}

/**
 * The spellings of "the round cap does not bind you", one list for every rail that scans for them (#395). It was
 * two hand-copied literals that drifted at birth (nine patterns in the §7 rail, six in the #310 rail). A list of
 * spellings, not a proof: a novel wording walks past it, and widening it is the treadmill `review-pr` §7's own
 * incident is about. A rail that must not scan one of them filters it out by name at its own call site; none does.
 */
export const ROUND_CAP_ESCAPES: RegExp[] = [
  /\bsince the last push\b/i, /\bbinds you\b/i, /\bif you would rather\b/i, /\bthe cap does not apply\b/i,
  /\bas often as you (need|like)\b/i, /\bat your discretion\b/i, /\b(only|merely) a guideline\b/i,
  /\bnot a hard\b/i, /\bthree rounds each\b/i,
];

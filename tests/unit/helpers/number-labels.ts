// The KS2 number-label rail (#1047): every KS2 card must print SATs-style numbers — a real minus sign,
// commas from four digits, no float artefact — never JavaScript's own `String(n)` shape. This is the
// checker; `ks2-number-labels.test.ts` runs it over `fmt()` and over every `isKs2` registry topic.

export interface LabelProblemsOpts {
  /** A four-digit whole number from 1000 to 2099 may appear with no comma (a year). */
  years?: boolean;
}

const YEAR_RE = /^(?:1[0-9]{3}|20[0-9]{2})$/;

/**
 * Every problem `text` has with SATs-style number formatting, or `[]` if it has none. Three independent
 * scans, each named by the mistake it catches rather than by a single "is this a valid number" grammar —
 * a real sentence mixes numbers with words ("twenty-four", "the suffix -ly") too freely for one regex to
 * parse the whole string as a number grammar without also mis-reading those words as numbers.
 */
export function labelProblems(text: string, opts: LabelProblemsOpts = {}): string[] {
  const problems: string[] = [];

  // An ASCII "-" is a minus sign only when it sits where a sign can sit (line start, after a space, "(" or
  // "=") and is immediately followed by a digit. "twenty-four" and "-ly" both fail that: the character
  // after the hyphen there is a letter, not a digit.
  for (const m of text.matchAll(/(?:^|[\s(=])-(?=\d)/g)) {
    problems.push(`ASCII "-" used as a minus sign at "${text.slice(m.index, m.index + 8)}" — U+2212 only`);
  }

  // More than 3 decimal places is JS float noise (0.1 + 0.2 = 0.30000000000000004); KS2 never carries a
  // remainder past thousandths.
  for (const m of text.matchAll(/\d+\.(\d+)/g)) {
    if (m[1].length > 3) problems.push(`"${m[0]}" has more than 3 decimal places`);
  }

  // A space where a comma should group thousands ("10 000") — checked before the plain-digit-run check
  // below, since a run this shape never has 4+ digits in one unbroken group for that check to catch.
  for (const m of text.matchAll(/\d[\d,]*(?: \d{3})+/g)) {
    problems.push(`"${m[0]}" groups digits with a space, not a comma`);
  }

  // A bare run of 4+ digits with no comma at all. The lookbehind keeps this from re-flagging a group
  // already inside a correctly comma-separated number ("1,004,235"'s "004" and "235" are each preceded by
  // a comma, so no match starts there) or a decimal fraction ("0.30000000000000004"'s digits are preceded
  // by "." — caught above instead, as a float artefact, not a grouping problem).
  for (const m of text.matchAll(/(?<![\d.,])\d{4,}/g)) {
    if (opts.years && YEAR_RE.test(m[0])) continue;
    problems.push(`"${m[0]}" is four or more digits with no comma grouping`);
  }

  return problems;
}

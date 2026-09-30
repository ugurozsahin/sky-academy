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

  // An ASCII "-" is a minus sign only when it sits where a sign can sit (line start, after a space, "(", "="
  // or "," — "1,-2" and "(3,-4)" both hide a minus right after a comma with no space) and is immediately
  // followed by a digit. "twenty-four" and "-ly" both fail that: the character after the hyphen there is a
  // letter, not a digit.
  for (const m of text.matchAll(/(?:^|[\s(=,])-(?=\d)/g)) {
    problems.push(`ASCII "-" used as a minus sign at "${text.slice(m.index, m.index + 8)}" — U+2212 only`);
  }

  // More than 3 decimal places is JS float noise (0.1 + 0.2 = 0.30000000000000004); KS2 never carries a
  // remainder past thousandths.
  for (const m of text.matchAll(/\d+\.(\d+)/g)) {
    if (m[1].length > 3) problems.push(`"${m[0]}" has more than 3 decimal places`);
  }

  // A space where a comma should group thousands ("10 000") — checked before the digit/comma span check
  // below, since a run this shape never lands in one unbroken span for that check to see (a plain space
  // isn't part of the character class it scans).
  for (const m of text.matchAll(/\d[\d,]*(?: \d{3})+/g)) {
    problems.push(`"${m[0]}" groups digits with a space, not a comma`);
  }

  // Every maximal "number token" — digits and commas, an optional decimal tail — starting and ending on a
  // digit, so "(−3, 4)"'s comma-then-space never joins "3" and "4" into one token (a space is in neither
  // character class either). Only the integer part is judged for grouping; the fraction is never comma-
  // grouped and is already covered by the float-artefact scan above, so it is split off and ignored here
  // rather than double-counted (or, worse, itself misread as an ungrouped integer).
  for (const m of text.matchAll(/\d(?:[\d,]*\d)?(?:\.\d+)?/g)) {
    const intPart = m[0].split('.')[0];
    const parts = intPart.split(',');
    if (parts.length === 1) {
      if (intPart.length < 4) continue;
      if (opts.years && YEAR_RE.test(intPart)) continue;
      problems.push(`"${intPart}" is four or more digits with no comma grouping`);
    } else if (parts[0].length > 3 || parts.slice(1).some(p => p.length !== 3)) {
      // A comma inside the token does not excuse the digits either side of it: "12,3456" still has an
      // ungrouped run of four after the comma, which a check that merely skips anything comma-adjacent
      // would miss entirely.
      problems.push(`"${intPart}" is grouped incorrectly — commas must mark exact groups of three digits`);
    }
  }

  return problems;
}

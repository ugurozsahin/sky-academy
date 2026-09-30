// The KS2 number-label rail (#1047): every KS2 card must print SATs-style numbers — a real minus sign,
// commas from four digits, no float artefact — never JavaScript's own `String(n)` shape. This is the
// checker; `ks2-number-labels.test.ts` runs it over `fmt()` and over every `isKs2` registry topic.

export interface LabelProblemsOpts {
  /**
   * The exact whole-number year value(s) expected in this text (review round 2): each must appear with no
   * comma, and nothing else is exempted for merely looking year-shaped. A blanket `years: true` (round 1's
   * shape) could not tell "the real year in this label" from "an unrelated number that happens to fall in
   * the same range" — `labelProblems('In 1999 the population grew by 1500.', {years: true})` wrongly waved
   * both numbers through. Naming the value(s) fixes that: `{years: [1999]}` exempts only a bare "1999" and
   * still catches "1500" needing its comma, and it also catches the opposite mistake — "1,999" written with
   * a comma is flagged as wrong for a year precisely because 1999 is one, not because it fails the ordinary
   * grouping check (which "1,999" would otherwise pass).
   */
  years?: number[];
}

/**
 * Every problem `text` has with SATs-style number formatting, or `[]` if it has none. Three independent
 * scans, each named by the mistake it catches rather than by a single "is this a valid number" grammar —
 * a real sentence mixes numbers with words ("twenty-four", "the suffix -ly") too freely for one regex to
 * parse the whole string as a number grammar without also mis-reading those words as numbers.
 */
export function labelProblems(text: string, opts: LabelProblemsOpts = {}): string[] {
  const problems: string[] = [];

  // An ASCII "-" is a minus sign whenever it is NOT glued to a preceding letter or digit (review round 1:
  // a colon, quote or closing bracket right before it — "Score:-5", "(x)-5", "\"-5\"" — is a sign as much as
  // a space is) and is followed, directly or via a single "£", by a digit ("-£3.50" is a sign too — a
  // currency symbol between the sign and the amount is an ordinary label shape, not an exception to it).
  // "twenty-four" and "-ly" both fail the first test: the character before the hyphen there is a letter.
  for (const m of text.matchAll(/(?<![A-Za-z0-9])-(?=£?\d)/g)) {
    problems.push(`ASCII "-" used as a minus sign at "${text.slice(m.index, m.index + 8)}" — U+2212 only`);
  }

  // More than 3 decimal places is JS float noise (0.1 + 0.2 = 0.30000000000000004); KS2 never carries a
  // remainder past thousandths.
  for (const m of text.matchAll(/\d+\.(\d+)/g)) {
    if (m[1].length > 3) problems.push(`"${m[0]}" has more than 3 decimal places`);
  }

  // A space where a comma should group thousands ("10 000") — checked before the digit/comma span check
  // below, since a run this shape never lands in one unbroken span for that check to see (a plain space
  // isn't part of the character class it scans). No comma in the leading run (review round 1): allowing one
  // let this bridge straight across an ordinary list separator into the next number entirely — "4,521, 891"
  // (two correctly-grouped numbers, comma-space between them) matched as "4,521, 891" and was flagged as a
  // bad grouping that was never there. A run already broken by its own comma is the other check's job.
  for (const m of text.matchAll(/\d+(?: \d{3})+/g)) {
    problems.push(`"${m[0]}" groups digits with a space, not a comma`);
  }

  // Every maximal "number token" — digits and commas, an optional decimal tail — starting and ending on a
  // digit, so "(−3, 4)"'s comma-then-space never joins "3" and "4" into one token (a space is in neither
  // character class either). Only the integer part is judged for grouping; the fraction is never comma-
  // grouped and is already covered by the float-artefact scan above, so it is split off and ignored here
  // rather than double-counted (or, worse, itself misread as an ungrouped integer).
  for (const m of text.matchAll(/\d(?:[\d,]*\d)?(?:\.\d+)?/g)) {
    const intPart = m[0].split('.')[0];
    const digitsOnly = intPart.replace(/,/g, '');
    const isYear = (opts.years ?? []).includes(Number(digitsOnly));
    const parts = intPart.split(',');
    if (parts.length === 1) {
      // No comma at all: fine if it's short, or it's the named year (a year is exempt from needing one).
      if (isYear || digitsOnly.length < 4) continue;
      problems.push(`"${digitsOnly}" is four or more digits with no comma grouping`);
    } else if (isYear) {
      // A comma at all, on a token that IS the named year, is wrong regardless of where it falls — review
      // round 2: "1,999" happens to satisfy the ordinary three-digit-group rule below, so only checking
      // that would wave a year-with-a-comma straight through.
      problems.push(`"${intPart}" is a year and must never carry a comma`);
    } else if (digitsOnly.length < 4) {
      // Too short to ever be a validly-grouped number at all (the smallest valid shape, "1,000", already
      // needs 4: one leading digit plus one exact three-digit group) — review round 2: "(3,4)" is ordinary
      // KS2 coordinate notation, not a mis-grouped number, and a check with no lower bound here blocked it
      // outright. A comma too short to represent grouping is content this rail has no business judging.
      continue;
    } else if (parts[0].length > 3 || parts.slice(1).some(p => p.length !== 3)) {
      // A comma inside the token does not excuse the digits either side of it: "12,3456" still has an
      // ungrouped run of four after the comma, which a check that merely skips anything comma-adjacent
      // would miss entirely.
      problems.push(`"${intPart}" is grouped incorrectly — commas must mark exact groups of three digits`);
    }
  }

  return problems;
}

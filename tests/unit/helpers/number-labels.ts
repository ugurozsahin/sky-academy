// The KS2 number-label rail (#1047): every KS2 card must print SATs-style numbers — a real minus sign,
// commas from four digits, no float artefact — never JavaScript's own `String(n)` shape. This is the
// checker; `ks2-number-labels.test.ts` runs it over `fmt()` and over every `isKs2` registry topic.

export interface LabelProblemsOpts {
  /**
   * The exact whole-number year value(s) expected in this text (review rounds 2-3): each must appear with
   * no comma, and nothing else is exempted for merely looking year-shaped. A blanket `years: true` (round
   * 1's shape) could not tell "the real year in this label" from "an unrelated number that happens to fall
   * in the same range" — naming the value(s) fixed that (round 2). But a value alone still can't say which
   * *occurrence* is the year when the same digits appear twice for different reasons in one string ("1200
   * sheep were counted, and in 1200 AD the town was founded" — one 1200 needs a comma, the other must not
   * carry one, and nothing here can tell which is which). Round 3's fix: when a candidate value's digits
   * occur more than once in the text, none of those occurrences is treated as the year — every one of them
   * is judged as an ordinary number instead. That can produce one false "needs a comma" on the real year in
   * that specific collision, but the alternative (silently trusting an unresolvable guess) hides a always-
   * real defect in the other occurrence entirely; a caller that hits the collision rewords one mention
   * rather than relying on this rail to read intent it has no way to read.
   */
  years?: number[];
}

/** How many times `value`'s digits occur as a token's value anywhere in `text` — comma or no comma, since
 *  both "1,999" and "1999" are candidate readings of the same year. Computed once per call, ahead of the
 *  main scan, so "is this occurrence unambiguous" is answered before any single match is judged. A
 *  parenthesised token is skipped, the same as the main scan skips it: a coordinate's two parts are never a
 *  number-token candidate in the first place, so its coincidental digit-concatenation must not count
 *  towards whether a real year elsewhere in the same text is ambiguous. */
function occurrenceCounts(text: string, values: number[]): Map<number, number> {
  const counts = new Map(values.map(v => [v, 0]));
  for (const m of text.matchAll(/\d(?:[\d,]*\d)?(?:\.\d+)?/g)) {
    const intPart = m[0].split('.')[0];
    if (text[m.index - 1] === '(' && text[m.index + intPart.length] === ')') continue;
    const v = Number(intPart.replace(/,/g, ''));
    if (counts.has(v)) counts.set(v, counts.get(v)! + 1);
  }
  return counts;
}

/**
 * The one problem (or none) a single number token has with its grouping — split out of `labelProblems` so
 * that function's own complexity stays under this repo's ratchet, not because this half is independently
 * reusable. `m` is a match of the number-token scan below; `isYear` is already resolved (unambiguous named
 * value or not) by the caller, which is why it is a plain boolean parameter rather than recomputed here.
 */
function groupingProblem(text: string, m: RegExpMatchArray, intPart: string, isYear: boolean): string | null {
  const digitsOnly = intPart.replace(/,/g, '');
  const parts = intPart.split(',');
  if (parts.length === 1) {
    // No comma at all: fine if it's short, or it's the named year (a year is exempt from needing one).
    if (isYear || digitsOnly.length < 4) return null;
    return `"${digitsOnly}" is four or more digits with no comma grouping`;
  }
  // Context, not digit count or year-ness, decides whether a bare comma-joined token is even a grouping
  // candidate at all (review round 3): round 2's "too short to be validly grouped" length cutoff both let a
  // real money typo through ("£3,00" is only 3 digits) and still flagged a legitimate coordinate whose two
  // parts happened to total 4+ ("(19,99)", whose digits also collide with a named year — checked first,
  // below, it would otherwise be misread as "a year written with a comma"). A token directly wrapped in
  // parentheses is coordinate/pair notation and is never a grouping OR a year candidate, whatever its digit
  // shape; a token directly preceded by "£" is money and always must be correctly grouped, however short.
  const before = text[m.index! - 1];
  const after = text[m.index! + intPart.length];
  if (before === '(' && after === ')') return null; // "(3,4)", "(19,99)" — two short numbers, not one
  // A comma at all, on a token that IS the named year, is wrong regardless of where it falls — review
  // round 2: "1,999" happens to satisfy the ordinary three-digit-group rule below, so only checking that
  // would wave a year-with-a-comma straight through.
  if (isYear) return `"${intPart}" is a year and must never carry a comma`;
  const isMoney = before === '£';
  const structurallyValid = parts[0].length <= 3 && parts.slice(1).every(p => p.length === 3);
  if (structurallyValid || !(isMoney || digitsOnly.length >= 4)) return null;
  // A comma inside the token does not excuse the digits either side of it: "12,3456" still has an ungrouped
  // run of four after the comma, which a check that merely skips anything comma-adjacent would miss
  // entirely; "£3,00" is only 3 digits but a comma is never valid in money at all. A short, uncontextualised
  // comma pair (neither money nor 4+ digits) has no realistic fixture demanding a verdict, so it falls
  // through the condition above unjudged — the same call round 2 made for exactly this shape.
  return `"${intPart}" is grouped incorrectly — commas must mark exact groups of three digits`;
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
  // character class either). Only the integer part is judged for grouping (by groupingProblem, above); the
  // fraction is never comma-grouped and is already covered by the float-artefact scan above, so it is split
  // off and ignored here rather than double-counted (or, worse, itself misread as an ungrouped integer).
  const yearCounts = occurrenceCounts(text, opts.years ?? []);
  for (const m of text.matchAll(/\d(?:[\d,]*\d)?(?:\.\d+)?/g)) {
    const intPart = m[0].split('.')[0];
    // A candidate year is only treated as one where it is the sole occurrence of that value in the text
    // (review round 3) — see occurrenceCounts' comment for why an ambiguous repeat is judged as ordinary
    // numbers instead of guessed at.
    const value = Number(intPart.replace(/,/g, ''));
    const isYear = (opts.years ?? []).includes(value) && yearCounts.get(value) === 1;
    const problem = groupingProblem(text, m, intPart, isYear);
    if (problem) problems.push(problem);
  }

  return problems;
}

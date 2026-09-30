// The KS2 number-label rail (#1047): every KS2 card must print SATs-style numbers — a real minus sign,
// commas from four digits, no float artefact — never JavaScript's own `String(n)` shape. This is the
// checker; `ks2-number-labels.test.ts` runs it over `fmt()` and over every `isKs2` registry topic.

export interface LabelProblemsOpts {
  /**
   * The exact whole-number year value(s) expected in this text (review rounds 2-3): each must appear with
   * no comma and no decimal place, and nothing else is exempted for merely looking year-shaped. Naming the
   * value(s) (round 2) fixed a blanket `years: true`'s inability to tell "the real year" from "an unrelated
   * number that happens to fall in the same range" apart. A value alone still can't say which *occurrence*
   * is the year when the same digits appear twice for different reasons in one string ("1200 sheep were
   * counted, and in 1200 AD the town was founded" — one needs a comma, the other must not carry one).
   * Round 3's fix: when a candidate value's digits occur more than once as a plain (non-money,
   * non-coordinate) token, none of those occurrences is treated as the year — every one is judged as an
   * ordinary number instead. That can produce one false "needs a comma" on the real year in that specific
   * collision, but the alternative (silently trusting an unresolvable guess) hides an always-real defect in
   * the other occurrence entirely.
   */
  years?: number[];
}

/** A number's role in the text, decided once per token (review round 5) rather than by separate, easily
 *  divergent adjacency checks in every function that needs it — see `classifyTokens`' own comment. */
type TokenRole = 'coordinate' | 'money' | 'plain';

interface NumberToken {
  /** Index of the first character of the whole token — the sign or "£" when present, else the first digit. */
  start: number;
  /** Index just past the last character of the whole token, decimal tail included. */
  end: number;
  /** The integer part exactly as written: digits and commas, no sign, no "£", no decimal tail. */
  intPart: string;
  /** Whether this token carries a decimal tail at all — a year can never have one (D3). */
  hasDecimal: boolean;
  role: TokenRole;
}

// Sign (ASCII "-" or the proper U+2212), then an optional "£", then the digit/comma run, then an optional
// decimal tail. Capturing the sign and "£" as part of the SAME match is what fixes a whole class of round
// 1-4 findings at once: a negative coordinate's "(" sits before the sign, not before the digit ("(−3,4500)"),
// and money is a property of the match itself (its own captured "£") rather than a separate look at
// whatever character happens to precede the digit run, which silently disagreed with the coordinate check's
// own idea of "before" once a sign or a decimal tail was in play (round 5, findings 1, 2, 3, 5).
const NUMBER_RE = /[-−]?(£)?\d(?:[\d,]*\d)?(?:\.\d+)?/g;

/**
 * Every number token in `text`, each classified once. A token is `'coordinate'` only when it contains a
 * comma AND its whole extent (sign included, decimal tail included) sits directly inside "(" and ")" — a
 * bare parenthesised single number like "(1999)" has no comma, so it is `'plain'`, not a coordinate (round
 * 5 finding 4: the old parens check excluded every parenthesised token from occurrence counting, coordinate
 * or not, which starved a legitimate bare year of the one count it needed to read as unambiguous). `'money'`
 * is any token whose own capture includes "£", whatever its digit count or sign.
 */
function classifyTokens(text: string): NumberToken[] {
  const tokens: NumberToken[] = [];
  for (const m of text.matchAll(NUMBER_RE)) {
    const start = m.index;
    const end = start + m[0].length;
    const intPart = m[0].replace(/^[-−]?£?/, '').split('.')[0];
    const hasDecimal = m[0].includes('.');
    const isCoordinate = intPart.includes(',') && text[start - 1] === '(' && text[end] === ')';
    const role: TokenRole = isCoordinate ? 'coordinate' : m[1] === '£' ? 'money' : 'plain';
    tokens.push({ start, end, intPart, hasDecimal, role });
  }
  return tokens;
}

/** How many times each of `values` occurs as a *plain* token's integer value anywhere in the text — money
 *  and coordinate tokens are excluded (their validity never depends on being "the year", so they must not
 *  count towards whether a real year elsewhere is ambiguous — review round 5 findings 2 and 4), and so is a
 *  decimal-tailed token (a fractional value is never literally the bare year, so an unrelated "1999.5" must
 *  not starve a real bare "1999" of its one unambiguous count — finding 7). */
function occurrenceCounts(tokens: NumberToken[], values: number[]): Map<number, number> {
  const counts = new Map(values.map(v => [v, 0]));
  for (const t of tokens) {
    if (t.role !== 'plain' || t.hasDecimal) continue;
    const v = Number(t.intPart.replace(/,/g, ''));
    if (counts.has(v)) counts.set(v, counts.get(v)! + 1);
  }
  return counts;
}

/** The one problem (or none) a single `'plain'`-or-`'money'` token has, given whether it is the unambiguous
 *  named year. Coordinates are never passed in (see the caller): their two parts are not one number to
 *  judge either way. Split out of `labelProblems` so that function's own complexity stays under this
 *  repo's ratchet, not because this half is independently reusable. */
function groupingProblem(t: NumberToken, isYear: boolean, looksLikeNamedYear: boolean): string | null {
  const parts = t.intPart.split(',');
  if (t.role === 'money') {
    // Money is always checked, however short — round 5: a money-shaped token equal to a named year is
    // still just money (correctly required to group at 4+ digits, never exempted as "the year"), and the
    // reverse (a malformed money value that happens to equal a year) is still a grouping defect, not a
    // year violation. Neither direction reads `isYear` at all.
    const structurallyValid = parts[0].length <= 3 && parts.slice(1).every(p => p.length === 3);
    if (structurallyValid || (parts.length === 1 && t.intPart.length < 4)) return null;
    return `"${t.intPart}" is grouped incorrectly — commas must mark exact groups of three digits`;
  }
  // A decimal tail on a token whose integer part IS a named year value is wrong on its own (a year has no
  // decimal places, D3) whether or not that occurrence is the *unambiguous* one — review round 5 finding 6.
  // Checked ahead of (and independently of) `isYear`, since a decimal-tailed token is never counted towards
  // occurrence ambiguity in the first place (occurrenceCounts' own comment), so `isYear` alone would never
  // catch this: nothing would ever make it the "sole" occurrence to begin with.
  if (t.hasDecimal && looksLikeNamedYear) return `"${t.intPart}" is a year and must not have a decimal place`;
  if (isYear) {
    if (parts.length > 1) return `"${t.intPart}" is a year and must never carry a comma`;
    return null; // a bare, comma-free year needs nothing further
  }
  if (parts.length === 1) {
    if (t.intPart.length < 4) return null;
    return `"${t.intPart}" is four or more digits with no comma grouping`;
  }
  const structurallyValid = parts[0].length <= 3 && parts.slice(1).every(p => p.length === 3);
  if (structurallyValid || t.intPart.length < 4) return null;
  // A comma inside the token does not excuse the digits either side of it: "12,3456" still has an
  // ungrouped run of four after the comma, which a check that merely skips anything comma-adjacent would
  // miss entirely.
  return `"${t.intPart}" is grouped incorrectly — commas must mark exact groups of three digits`;
}

/**
 * Every problem `text` has with SATs-style number formatting, or `[]` if it has none. Independent scans,
 * each named by the mistake it catches rather than by a single "is this a valid number" grammar — a real
 * sentence mixes numbers with words ("twenty-four", "the suffix -ly") too freely for one regex to parse the
 * whole string as a number grammar without also mis-reading those words as numbers.
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

  // A space where a comma should group thousands ("10 000") — checked before the token scan below, since a
  // run this shape never lands in one unbroken token for that scan to see (a plain space isn't part of the
  // character class it matches).
  for (const m of text.matchAll(/\d+(?: \d{3})+/g)) {
    problems.push(`"${m[0]}" groups digits with a space, not a comma`);
  }

  // Every number token, classified once (coordinate / money / plain — see classifyTokens), judged for
  // grouping. A coordinate's two parts are never one number to judge, so it is skipped outright rather than
  // passed to groupingProblem at all.
  const tokens = classifyTokens(text);
  const yearCounts = occurrenceCounts(tokens, opts.years ?? []);
  for (const t of tokens) {
    if (t.role === 'coordinate') continue;
    const value = Number(t.intPart.replace(/,/g, ''));
    // A candidate year is only treated as one where it is the sole occurrence of that value among plain
    // tokens in the text (review rounds 3 and 5) — see occurrenceCounts' own comment for what is excluded
    // from that count and why.
    const looksLikeNamedYear = (opts.years ?? []).includes(value);
    const isYear = looksLikeNamedYear && yearCounts.get(value) === 1;
    const problem = groupingProblem(t, isYear, looksLikeNamedYear);
    if (problem) problems.push(problem);
  }

  return problems;
}

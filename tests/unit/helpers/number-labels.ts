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

interface Span { start: number; end: number }
interface CoordinateSpan extends Span { components: [string, string] }

const PLAIN_COMPONENT_RE = /^[-−]?\d+(?:\.\d+)?$/;

/**
 * Every "(...)" span whose inner content is genuinely a coordinate/pair — not just "has a comma and sits in
 * parens", which round 5's design used as a proxy and which cannot tell a real pair from a single malformed
 * number, or money, that merely happens to sit in parens (review round 6 findings 2 and 6). The content
 * must split on exactly one comma into two non-"£" halves, each matching a plain signed/decimal number on
 * its own. Given that, whether the pair is read as two numbers or misread as a single mis-grouped one comes
 * down to one more question: could `"a,b"` plausibly be *one* number with its thousands comma in the wrong
 * place? Only when it could — no sign, no decimal, no stray whitespace anywhere, and `b` is 4+ digits, the
 * one length a genuine SATs group can never be (the shape "1,2345" is written) — is it read as one number
 * instead (finding 6). A sign, a decimal point, or whitespace next to the comma never appears inside a
 * single written number at all, so any of those settles it as a pair outright, however long `b` is (findings
 * 1, 3, 4, 5 — a coordinate component is not bounded to 3 digits the way a thousands group is).
 *
 * Being a genuine pair only settles what the *separating* comma means; it is not a verdict on either
 * component's own formatting (review round 7) — `coordinateComponentProblems`, below, is what still checks
 * that.
 */
function findCoordinateSpans(text: string): CoordinateSpan[] {
  const spans: CoordinateSpan[] = [];
  for (const m of text.matchAll(/\(([^()]*)\)/g)) {
    const rawParts = m[1].split(',');
    if (rawParts.length !== 2) continue;
    const [a, b] = rawParts.map(p => p.trim());
    if (!a || !b || a.includes('£') || b.includes('£')) continue;
    if (!PLAIN_COMPONENT_RE.test(a) || !PLAIN_COMPONENT_RE.test(b)) continue;
    const hasWhitespace = rawParts[0] !== a || rawParts[1] !== b;
    const hasSignOrDecimal = /[-−.]/.test(a) || /[-−.]/.test(b);
    const bLooksLikeAGroup = b.replace(/^[-−]/, '').length <= 3;
    if (!hasWhitespace && !hasSignOrDecimal && !bLooksLikeAGroup) continue; // "(1,2345)" — one number, not a pair
    spans.push({ start: m.index, end: m.index + m[0].length, components: [a, b] });
  }
  return spans;
}

/**
 * A coordinate component is never subject to the multi-group comma-*position* rule — the split above
 * already guarantees it carries no comma of its own to misplace — but it still owes the one rule that
 * applies to any number regardless of context: 4 or more digits needs a comma (review round 7). Every
 * round through the sixth treated "is this genuinely a pair" as the whole question and, once it answered
 * yes, exempted both components from every check `labelProblems` exists to run — silently, for anything
 * sitting in parens next to a comma, however long either side was.
 */
function coordinateComponentProblems(spans: CoordinateSpan[]): string[] {
  const problems: string[] = [];
  for (const { components } of spans) {
    for (const c of components) {
      const digits = c.replace(/^[-−]/, '').split('.')[0];
      if (digits.length >= 4) problems.push(`"${c}" is four or more digits with no comma grouping`);
    }
  }
  return problems;
}

interface NumberToken {
  /** The integer part exactly as written: digits and commas, no sign, no "£", no decimal tail. */
  intPart: string;
  /** Whether this token carries a decimal tail at all — a year can never have one (D3). */
  hasDecimal: boolean;
  isMoney: boolean;
}

// Sign (ASCII "-" or the proper U+2212), then an optional "£", then the digit/comma run, then an optional
// decimal tail — everything a standalone (non-coordinate) number can carry, captured in one match so money
// and the decimal tail are read from the match itself rather than by inspecting whichever character happens
// to sit next to a bare digit run afterwards (review round 5).
const NUMBER_RE = /[-−]?(£)?\d(?:[\d,]*\d)?(?:\.\d+)?/g;

/** Every standalone number token in `text` — a coordinate's two components are pulled out first (see
 *  `findCoordinateSpans`) and never reach this scan at all, rather than being matched here and separately
 *  filtered afterwards; that split is what keeps this scan from having to understand coordinate shapes
 *  (a sign, a decimal or a space in the "wrong" position) in the first place. */
function scanTokens(text: string): NumberToken[] {
  const coordinateSpans = findCoordinateSpans(text);
  const tokens: NumberToken[] = [];
  for (const m of text.matchAll(NUMBER_RE)) {
    const start = m.index;
    const end = start + m[0].length;
    if (coordinateSpans.some(s => start >= s.start && end <= s.end)) continue;
    const intPart = m[0].replace(/^[-−]?£?/, '').split('.')[0];
    tokens.push({ intPart, hasDecimal: m[0].includes('.'), isMoney: m[1] === '£' });
  }
  return tokens;
}

/** How many times each of `values` occurs as a *plain* token's integer value anywhere in the text — money
 *  tokens are excluded (their validity never depends on being "the year", so they must not count towards
 *  whether a real year elsewhere is ambiguous — review round 5), and so is a decimal-tailed token (a
 *  fractional value is never literally the bare year, so an unrelated "1999.5" must not starve a real bare
 *  "1999" of its one unambiguous count). Coordinates never reach this at all (scanTokens' own comment). */
function occurrenceCounts(tokens: NumberToken[], values: number[]): Map<number, number> {
  const counts = new Map(values.map(v => [v, 0]));
  for (const t of tokens) {
    if (t.isMoney || t.hasDecimal) continue;
    const v = Number(t.intPart.replace(/,/g, ''));
    if (counts.has(v)) counts.set(v, counts.get(v)! + 1);
  }
  return counts;
}

/** The one problem (or none) a single token has, given whether it is the unambiguous named year. Split out
 *  of `labelProblems` so that function's own complexity stays under this repo's ratchet, not because this
 *  half is independently reusable. */
function groupingProblem(t: NumberToken, isYear: boolean, looksLikeNamedYear: boolean): string | null {
  const parts = t.intPart.split(',');
  if (t.isMoney) {
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

  // A coordinate's own components, each checked for the one rule that survives being read as a pair
  // (review round 7) — see coordinateComponentProblems' own comment.
  problems.push(...coordinateComponentProblems(findCoordinateSpans(text)));

  // Every standalone number token (a coordinate's two components are excluded before this point — see
  // scanTokens), judged for grouping.
  const tokens = scanTokens(text);
  const yearCounts = occurrenceCounts(tokens, opts.years ?? []);
  for (const t of tokens) {
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

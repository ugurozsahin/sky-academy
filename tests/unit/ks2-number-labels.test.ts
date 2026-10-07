import { describe, it, expect } from 'vitest';
import { dec, fmt, addDec } from '../../src/curriculum/ks2num';
import { isKs2 } from '../../src/curriculum/key-stage';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { labelProblems } from './helpers/number-labels';

// Deterministic RNG (mulberry32), the same construction curriculum.test.ts and ks2num.test.ts use.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const ri = (r: () => number, min: number, max: number) => min + Math.floor(r() * (max - min + 1));

/**
 * Topics whose labels are years, exempted from comma grouping (#1047, #1101, #1181). Neither topic exists
 * yet — this list is what those tickets add to, not something this ticket reads from the registry, since a
 * year format is a property of the topic's own domain (a calendar year, a Roman-numeral year) rather than
 * something derivable from `Topic` itself.
 */
const YEAR_LABEL_TOPICS = ['y3-calendar', 'y5-roman'];

describe('KS2 number-label rail (#1047): no float artefact, no ASCII minus, commas from four digits', () => {
  it('fmt() passes the rail over 1e5 random values, and its year form never adds a comma', () => {
    const r = rng(1047);
    for (let i = 0; i < 100_000; i++) {
      const kind = i % 3;
      const d = kind === 0 ? dec(ri(r, 0, 10_000_000), 0)
        : kind === 1 ? dec(-ri(r, 1, 1000), 0)
          : dec(ri(r, -1_000_000, 1_000_000), ri(r, 1, 3));
      const label = fmt(d);
      expect(labelProblems(label), `fmt(${JSON.stringify(d)}) = "${label}"`).toEqual([]);
    }
    for (const y of [1000, 1999, 2026, 2099]) {
      const label = fmt(dec(y, 0), { year: true });
      expect(label, label).not.toContain(',');
      expect(labelProblems(label, { years: [y] }), label).toEqual([]);
    }
  });

  it('fmt() rejects a year given decimal places, a negative value, or fixedDp', () => {
    expect(() => fmt(dec(1999, 0), { year: true, fixedDp: 2 })).toThrow(/mutually exclusive/);
    expect(() => fmt(dec(19995, 1), { year: true })).toThrow(/fractional/);
    expect(() => fmt(dec(-1999, 0), { year: true })).toThrow(/negative/);
  });

  it('fmt() accepts a whole year even at a nonzero dp (review round 1): dp is storage scale, not a remainder', () => {
    // addDec/alignment can leave an exact whole number at dp > 0 — dec(1999, 0) + dec(0, 2) is
    // {v: 199900, dp: 2}, exactly 1999 — and the old `a.dp > 0` guard misread that as fractional.
    const aligned = addDec(dec(1999, 0), dec(0, 2));
    expect(fmt(aligned, { year: true })).toBe('1999');
  });

  it('years exempts only the exact value named, never anything merely year-shaped (review round 2)', () => {
    // "In 1999 the population grew by 1500." — a blanket years:true (round 1's shape) could not tell 1999
    // (the real year) from 1500 (an ordinary count that happens to fall in the same range) apart, and
    // exempted both. Naming the value fixes it: 1500 still needs its comma.
    expect(labelProblems('In 1999 the population grew by 1500.', { years: [1999] }))
      .toEqual(['"1500" is four or more digits with no comma grouping']);
    // A value not in the list is never exempted, however year-shaped it looks.
    expect(labelProblems('2100', { years: [1999] })).not.toEqual([]);
  });

  it('a comma on the named year is wrong regardless of where it falls (review round 2)', () => {
    // "1,999" happens to satisfy the ordinary three-digit-group rule, so only checking that would wave a
    // year written with a comma straight through — a year must never carry one at all (CLAUDE.md D3).
    expect(labelProblems('1,999', { years: [1999] }))
      .toEqual(['"1,999" is a year and must never carry a comma']);
    // Without naming 1999 as the year, "1,999" is just an ordinary, correctly-grouped 4-digit quantity.
    expect(labelProblems('1,999')).toEqual([]);
  });

  it('two independent problems in one string both get reported', () => {
    expect(labelProblems('-12345')).toHaveLength(2); // the "-1" minus sign, and "12345" ungrouped
    expect(labelProblems('-3 and 12345')).toHaveLength(2);
  });

  it('a comma does not excuse the digits either side of it', () => {
    // "12,3456" — a comma that lands nowhere near a three-digit boundary is still a bad grouping, not a
    // free pass for the run of four after it: a check that only skips digits *preceded* by a comma would
    // miss this entirely.
    expect(labelProblems('12,3456')).toHaveLength(1);
    expect(labelProblems('1,004,235')).toEqual([]); // real three-digit groups throughout: still fine
  });

  it('an ASCII minus right after a comma, with no space, is still caught', () => {
    expect(labelProblems('1,-2')).toHaveLength(1);
    expect(labelProblems('(3,-4)')).toHaveLength(1);
  });

  it('a coordinate pair is never read as a mis-grouped number (review rounds 2-3)', () => {
    // "(3,4)" is ordinary KS2 content — NC Year 4/6 position and direction — not a 34 written with a stray
    // comma. A token directly wrapped in parentheses is never a grouping candidate at all, whatever its
    // digit shape (round 3: a digit-count threshold alone let a real money typo through AND still flagged
    // a legitimate longer coordinate like "(19,99)" — see the money and coordinate-vs-year tests below).
    expect(labelProblems('(3,4)')).toEqual([]);
    expect(labelProblems('Plot the point (3,4) on the grid')).toEqual([]);
    expect(labelProblems('(12,345)')).toEqual([]); // happens to look well-formed too; still exempt either way
    expect(labelProblems('(19,99)')).toEqual([]); // 4+ total digits, but still just two short numbers
  });

  it('a comma is never valid in money, however short (review round 3)', () => {
    // "£3,00" is the classic continental-decimal typo (a comma where SATs style needs a full stop, "£3.00")
    // — round 2's coordinate-length exemption wrongly waved this through too, since its comma-joined token
    // is only 3 digits. A token directly preceded by "£" is always money, never a coordinate, so it's
    // always checked regardless of length.
    expect(labelProblems('The toy costs £3,00 today, not £4,50.')).toHaveLength(2);
    expect(labelProblems('£1,234.56')).toEqual([]); // a real, correctly-grouped amount: still fine
  });

  it('a coordinate is never misread as a year sharing its concatenated digits (review round 3)', () => {
    // "(19,99)" is an ordinary coordinate; naming 1999 as a year must not make the coordinate-detection
    // lose to the year check just because "19" + "99" happens to concatenate to the named value.
    expect(labelProblems('The shape is at (19,99) on the grid.', { years: [1999] })).toEqual([]);
    // A real bare year sharing digits with a nearby coordinate is still correctly exempt — the coordinate
    // itself does not count as a competing "1999" occurrence (occurrenceCounts skips parenthesised tokens).
    expect(labelProblems('The shape is at (19,99) on the grid, in 1999.', { years: [1999] })).toEqual([]);
  });

  it('an ambiguous repeated year value is judged as ordinary numbers, not silently exempted (review round 3)', () => {
    // The same digits, twice, for two different reasons — nothing here can tell "1200 sheep" (needs a
    // comma) from "1200 AD" (must not have one) apart, so both are judged as ordinary numbers rather than
    // both being silently waved through (which round 2's design did, hiding the real "1200 sheep" defect
    // entirely). One of the two flagged results is a false positive on the real year in this specific
    // collision — a bounded, documented trade-off (see LabelProblemsOpts' own comment) — not a silent miss.
    expect(labelProblems('1200 sheep were counted, and in 1200 AD the town was founded.', { years: [1200] }))
      .toHaveLength(2);
    expect(labelProblems('There were 1999 apples in 1999.', { years: [1999] })).toHaveLength(2);
  });

  it('a coordinate with a sign or a decimal-tailed component is still recognised as one (review round 5)', () => {
    // "(−3,4500)" — the round-3 coordinate check looked at the character right before the digit run, which
    // is the sign for a negative first component, not "(". "(19,99.5)" — the "after" check expected ")"
    // right after the integer part, but a decimal point sits there instead. Both are ordinary coordinates,
    // still correctly read as a pair (no "grouped incorrectly" comma-position message) — "4500" itself
    // being 4 digits is a separate, later-found gap (review round 7, its own test below).
    expect(labelProblems('(−3,4500)')).toEqual(['"4500" is four or more digits with no comma grouping']);
    expect(labelProblems('(19,99.5)')).toEqual([]);
  });

  it('money always wins over a coincidental year value, in both directions (review round 5)', () => {
    // Correct money equal to a named year is still just money, not "a year written with a comma" — and
    // malformed money equal to a named year is still a grouping defect, not exempted as "the year".
    expect(labelProblems('The prize is £1,999.', { years: [1999] })).toEqual([]);
    expect(labelProblems('This vase, worth £1999, was made that year.', { years: [1999] }))
      .toEqual(['"1999" is grouped incorrectly — commas must mark exact groups of three digits']);
    // A bare real year elsewhere in the same sentence as money sharing its digits is unaffected either way
    // — money is excluded from occurrence-ambiguity counting, the same as a coordinate.
    expect(labelProblems('The book, made in 1999, costs £1,999.', { years: [1999] })).toEqual([]);
  });

  it('a bare year wrapped in unrelated parentheses is still exempt (review round 5)', () => {
    // "(1999)" has no comma, so it is not a coordinate at all — just a bare year in parenthetical prose
    // ("the population (1999) grew"). The old parens-skip in occurrence counting excluded every
    // parenthesised token regardless of a comma, starving this of the one count it needed to read as
    // unambiguous.
    expect(labelProblems('(1999)', { years: [1999] })).toEqual([]);
  });

  it('a year is never allowed a decimal place, independently of the comma check (review round 5)', () => {
    expect(labelProblems('1999.5', { years: [1999] }))
      .toEqual(['"1999" is a year and must not have a decimal place']);
    // A decimal-tailed lookalike must not corrupt a genuine bare year elsewhere in the same text — it is
    // simply never counted as a same-value occurrence in the first place (it is flagged on its own merits).
    expect(labelProblems('The year was 1999, though 1999.5 is not a valid year.', { years: [1999] }))
      .toEqual(['"1999" is a year and must not have a decimal place']);
  });

  it('a coordinate component may itself be signed, decimal-tailed or spaced from the comma (review round 6)', () => {
    // A coordinate's two components are pulled out as a pair before either is judged individually — a sign
    // or a decimal on one component, or whitespace anywhere near the comma, settles "this is a pair, not
    // one mis-grouped number" outright, whatever the other component's own shape. Each component still
    // owes its own "4+ digits needs a comma" check once it's read as a pair member (round 7, below) — these
    // five all happen to have a 4-digit component, so each now reports exactly one problem, on that
    // component, rather than the `[]` round 6 alone established (a real gap round 7 found and this closes).
    expect(labelProblems('(12,−1000)')).toEqual(['"−1000" is four or more digits with no comma grouping']);
    expect(labelProblems('(3.5,1000)')).toEqual(['"1000" is four or more digits with no comma grouping']);
    expect(labelProblems('(−12,−1000)')).toEqual(['"−1000" is four or more digits with no comma grouping']);
    expect(labelProblems('(3, 4500)')).toEqual(['"4500" is four or more digits with no comma grouping']);
    expect(labelProblems('(12 ,1000)')).toEqual(['"1000" is four or more digits with no comma grouping']);
    // Still correctly read as a pair at all, not a single number: no "grouped incorrectly" comma-position
    // message, which is what a misread as one number would have produced instead.
    expect(labelProblems('(3, 4500)')[0]).not.toMatch(/grouped incorrectly/);
  });

  it('money in parentheses is still money, not a coordinate (review round 6)', () => {
    // "(£4,50)" must fail exactly like unparenthesised "£4,50" — a pair's two components are never "£",
    // which is what actually distinguishes a coordinate from money that merely sits in parens.
    expect(labelProblems('She saved (£4,50) this year.')).toHaveLength(1);
    expect(labelProblems('She saved £4,50 this year.')).toHaveLength(1);
  });

  it('a parenthesised badly-grouped plain number is still flagged, not read as a coordinate (review round 6)', () => {
    // "(1,2345)" — no sign, no decimal, no whitespace anywhere, and its second half is 4+ digits: the one
    // length a genuine thousands group can never be. That combination could plausibly be one number with
    // its comma in the wrong place ("12,345" written as "1,2345"), so it is judged as one, exactly like the
    // unparenthesised text — unlike "(19,99)", whose second half is short enough that misreading it as a
    // pair costs nothing either way.
    expect(labelProblems('The crowd numbered (1,2345) that day.')).toHaveLength(1);
    expect(labelProblems('The crowd numbered 1,2345 that day.')).toHaveLength(1);
  });

  it('a coordinate mis-split does not corrupt an unrelated standalone year (review round 6)', () => {
    // Confirms scanTokens' exclusion is a hard boundary: nothing inside a detected coordinate span ever
    // reaches the ordinary token scan, so it cannot collide with occurrence counting for a real year
    // elsewhere in the same text, however the coordinate's own components are shaped. The coordinate's own
    // "−1000" component still gets its own comma-length check (review round 7); only the year exemption is
    // what's confirmed unaffected here.
    expect(labelProblems('The point (12,−1000) marks the spot founded in 1000.', { years: [1000] }))
      .toEqual(['"−1000" is four or more digits with no comma grouping']);
  });

  it('a coordinate component still owes its own "4+ digits needs a comma" check (review round 7)', () => {
    // Being read as a genuine pair only settles what the separating comma means; it says nothing about
    // either component's own formatting. Every one of these was `[]` before round 7 — silently exempted
    // just for sitting in parens next to a comma, whichever signal made the pair-classification correct.
    expect(labelProblems('Plot the point (12345,400) on the grid.'))
      .toEqual(['"12345" is four or more digits with no comma grouping']);
    expect(labelProblems('(3, 12345)')).toEqual(['"12345" is four or more digits with no comma grouping']);
    expect(labelProblems('(3.5,12345)')).toEqual(['"12345" is four or more digits with no comma grouping']);
    // "(1234,567)" is still correctly read as a pair (b="567" is short), but a itself is malformed — the
    // fix that closes this also closes the narrower classification asymmetry finding 1 named separately.
    expect(labelProblems('(1234,567) marks it.')).toEqual(['"1234" is four or more digits with no comma grouping']);
    // Controls: unaffected cases stay exactly as before.
    expect(labelProblems('The crowd numbered 2345 that day.'))
      .toEqual(['"2345" is four or more digits with no comma grouping']); // unparenthesised: already worked
    expect(labelProblems('The point (400,12345) on the grid.'))
      .toEqual(['"400,12345" is grouped incorrectly — commas must mark exact groups of three digits']); // never classified as a pair at all (b is 4+ digits, no sign/decimal/space) — read as one number, as before
  });

  it('a list of correctly-grouped numbers never trips the space-grouping check (review round 1)', () => {
    // The old space check let its leading run swallow commas, so it bridged straight across an ordinary
    // ", " list separator into the next number: "4,521, 891" read as one bad grouping when both numbers
    // were fine on their own. "Order these numbers" / "which is bigger" is the obvious next KS2 shape.
    expect(labelProblems('Order these numbers: 4,521, 891, 10,234')).toEqual([]);
    expect(labelProblems('1,234, 567')).toEqual([]);
  });

  it('an ASCII minus is caught after a colon, a quote or a closing bracket, with no space (review round 1)', () => {
    expect(labelProblems('Score:-5')).toHaveLength(1);
    expect(labelProblems('(x)-5')).toHaveLength(1);
    expect(labelProblems('"-5"')).toHaveLength(1);
  });

  it('an ASCII minus is caught before a currency symbol too (review round 1)', () => {
    expect(labelProblems('Change: -£3.50')).toHaveLength(1);
  });

  it('every isKs2 registry topic\'s prompt, answer and options pass the rail', () => {
    const ks2Topics = TOPICS.filter(t => isKs2(t.year));
    for (const t of ks2Topics) {
      const isYearTopic = YEAR_LABEL_TOPICS.includes(t.id);
      const r = rng(2000 + t.id.length);
      for (const d of [1, 2, 3] as Difficulty[]) {
        for (let i = 0; i < 150; i++) {
          const q = t.gen(d, r);
          // A year-label topic's own answer IS the year for that draw — named explicitly (review round 2:
          // a blanket years flag can't tell the real year from a coincidental in-range number sharing the
          // same label), best-effort until a real topic lands and fixes its actual answer shape.
          const years = isYearTopic && /^\d+$/.test(q.answer) ? [Number(q.answer)] : undefined;
          for (const label of [q.prompt, q.answer, ...q.options]) {
            expect(labelProblems(label, { years }), `${t.id} d${d}: "${label}"`).toEqual([]);
          }
        }
      }
    }
    // Not a vacuous pass by accident: #1050 landed the first KS2 topic (`y3-count`), so this loop now runs
    // for real rather than being proven only against `fmt()` above.
    expect(ks2Topics.length, 'the KS2 registry sweep must have at least one real topic to check').toBeGreaterThan(0);
  }, 30_000);   // the sweep grows with every KS2 topic; the 5 s default timed out on a loaded CI runner (#1641)

  it.each([
    ['0.30000000000000004', 1],
    ['-3', 1],
    ['1000', 1],
    ['10 000', 1],
    ['−3', 0],
    ['1,000', 0],
    ['3.75', 0],
    ['£1,234.56', 0],
    ['12.5%', 0],
    ['twenty-four', 0],
    ['-ly', 0],
    ['(−3, 4)', 0],
  ] as const)('%s has %i problem(s)', (text, count) => {
    expect(labelProblems(text)).toHaveLength(count);
  });

  it('"1999" fails with no years option and passes when named as the year', () => {
    expect(labelProblems('1999')).not.toEqual([]);
    expect(labelProblems('1999', { years: [1999] })).toEqual([]);
  });
});

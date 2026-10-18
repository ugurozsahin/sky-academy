// Spoken forms for KS2 notation (#1057). A speech engine reads written maths wrong — "3/4" can sound like
// a date, "3.75" like "three seventy-five". `ks2Say` turns it into words a teacher would say; `sayIsSafe`
// proves none of it is left. `util.ts` (its own line cap) stays untouched: `symSay`'s operator words still
// run, but only over the plain characters the tokenizer below leaves as ordinary text — never over a
// notation span.
//
// Both functions walk the same left-to-right tokenizer (`tokenize`) instead of two hand-maintained regex
// sets. Eleven review rounds on PR #1430 found a recurring class of bug in the pre-tokenizer design: a
// `ks2Say` conversion pass and the `sayIsSafe` check meant to catch what it missed disagreed about where
// one piece of notation ends and the next begins, because each was a separate regex free to define
// "adjacent" its own way. A shared tokenizer removes that seam — `ks2Say` renders every non-prose token it
// finds, `sayIsSafe` fails whenever one is left un-rendered.
//
// **Roman numerals are declared, never guessed (#1057, #1463).** Eleven rounds on PR #1430 found nine
// defects in *detecting* a numeral in free text: "V" is a numeral, a variable and a letter, and "Roman
// numeral V" is both ordinary prose and `ks2Say`'s own rendering. So there is no detection. A caller that
// knows its card holds a numeral says so — `ks2Say(text, { roman: ['XIV'] })` — and only a whole letter run
// equal to a declared, canonical numeral is spoken as letters ("Roman numeral X, I, V", never its value:
// a card may ask what XIV means). Declared numerals are matched before unit codes, so "CM" or "MM" declared
// is a numeral, not centimetres. `sayIsSafe` takes no declaration and never flags a numeral either way.
import { symSay, UNIT_WORD } from './util';
import { fromRoman } from './roman';

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** Cardinal number word, any non-negative integer — the decimal/mixed-fraction whole part below can run
 *  into the hundreds, thousands or millions (a KS2 money or measurement value). */
function cardinal(n: number): string {
  if (n < 20) return ONES[n];
  if (n < 100) {
    const tens = Math.floor(n / 10), ones = n % 10;
    return ones === 0 ? TENS[tens] : `${TENS[tens]}-${ONES[ones]}`;
  }
  if (n < 1000) {
    const hundreds = Math.floor(n / 100), rest = n % 100;
    return rest === 0 ? `${ONES[hundreds]} hundred` : `${ONES[hundreds]} hundred and ${cardinal(rest)}`;
  }
  if (n < 1000000) {
    const thousands = Math.floor(n / 1000), rest = n % 1000;
    return rest === 0 ? `${cardinal(thousands)} thousand` : `${cardinal(thousands)} thousand ${cardinal(rest)}`;
  }
  const millions = Math.floor(n / 1000000), rest = n % 1000000;
  return rest === 0 ? `${cardinal(millions)} million` : `${cardinal(millions)} million ${cardinal(rest)}`;
}

const ORDINAL_ONES: Record<number, string> = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth', 6: 'sixth', 7: 'seventh', 8: 'eighth', 9: 'ninth' };
const ORDINAL_TEENS: Record<number, string> = { 10: 'tenth', 11: 'eleventh', 12: 'twelfth', 13: 'thirteenth', 14: 'fourteenth', 15: 'fifteenth', 16: 'sixteenth', 17: 'seventeenth', 18: 'eighteenth', 19: 'nineteenth' };
const ORDINAL_TENS: Record<number, string> = { 2: 'twentieth', 3: 'thirtieth', 4: 'fortieth', 5: 'fiftieth', 6: 'sixtieth', 7: 'seventieth', 8: 'eightieth', 9: 'ninetieth' };
/** The ordinal fallback below `DENOM_WORD`'s table, for a real KS2 denominator like 20 or 1000 (tenths/
 *  hundredths/thousandths, Y5-6) that a bare cardinal+"th" mangles ("twentyth", "one one thousandth"). */
function ordinalWord(n: number): string {
  if (n < 10) return ORDINAL_ONES[n] ?? 'zeroth';
  if (n < 20) return ORDINAL_TEENS[n];
  if (n < 100) {
    const tens = Math.floor(n / 10), ones = n % 10;
    return ones === 0 ? ORDINAL_TENS[tens] : `${TENS[tens]}-${ORDINAL_ONES[ones]}`;
  }
  if (n < 1000) {
    const hundreds = Math.floor(n / 100), rest = n % 100;
    // Always names the hundreds digit, even at exactly n·100 — unlike `cardinal`, this had a special case
    // dropping it ("hundredth" not "one hundredth") on the reasoning that it reads more naturally alone at
    // *exactly* 100. But `denomWord`'s own table intercepts exactly 100 before this function ever runs, so
    // the dropped digit was only ever visible where it is wrong: composed under a larger denominator like
    // 1100 ("...thousand hundredths", the "one" of "one hundred" silently missing) — PR #1430 round 7.
    if (rest === 0) return `${ONES[hundreds]} hundredth`;
    return `${ONES[hundreds]} hundred and ${ordinalWord(rest)}`;
  }
  if (n < 1000000) {
    const thousands = Math.floor(n / 1000), rest = n % 1000;
    if (rest === 0) return thousands === 1 ? 'thousandth' : `${cardinal(thousands)} thousandth`;
    return `${cardinal(thousands)} thousand ${ordinalWord(rest)}`;
  }
  const millions = Math.floor(n / 1000000), rest = n % 1000000;
  if (rest === 0) return millions === 1 ? 'millionth' : `${cardinal(millions)} millionth`;
  return `${cardinal(millions)} million ${ordinalWord(rest)}`;
}

const DENOM_WORD: Record<number, string> = {
  2: 'half', 3: 'third', 4: 'quarter', 5: 'fifth', 6: 'sixth', 7: 'seventh', 8: 'eighth',
  9: 'ninth', 10: 'tenth', 11: 'eleventh', 12: 'twelfth', 100: 'hundredth',
};
const denomWord = (d: number): string => DENOM_WORD[d] ?? ordinalWord(d);
/** "3/4" -> "three quarters", "1/2" -> "one half" (the one irregular plural). */
function fracWord(n: number, d: number): string {
  const denom = denomWord(d);
  const plural = n === 1 ? denom : denom === 'half' ? 'halves' : `${denom}s`;
  return `${cardinal(Math.abs(n))} ${plural}`;
}

/** cm²/m²/km/mm/mg are not in `UNIT_WORD` (util.ts:211); everything else — cm, m, g, ml, kg, l — is. */
const EXTRA_UNIT_WORD: Record<string, string> = {
  'cm²': 'square centimetres', 'm²': 'square metres', 'km²': 'square kilometres', 'mm²': 'square millimetres',
  'cm³': 'cubic centimetres', 'm³': 'cubic metres', km: 'kilometres', mm: 'millimetres', mg: 'milligrams',
  'km/h': 'kilometres per hour', 'm/s': 'metres per second',
};
const unitWord = (u: string): string => EXTRA_UNIT_WORD[u] ?? UNIT_WORD[u] ?? u;
// A multi-letter unit code is unambiguous wherever it stands alone (no ordinary KS2 word is exactly "kg"
// or "cm²"), so it is always notation. "m"/"g"/"l" alone are also real algebra variables, so they only
// count as notation immediately after a digit — see `singleLetterUnitOK`.
const MULTI_LETTER_UNITS = new Set(['cm²', 'm²', 'km²', 'mm²', 'cm³', 'm³', 'km', 'mm', 'ml', 'mg', 'kg', 'cm']);
const SINGLE_LETTER_UNITS = new Set(['m', 'g', 'l']);
const singleLetterUnitOK = (text: string, start: number): boolean => /[0-9] ?$/.test(text.slice(0, start));

export type TokKind = 'text' | 'digit' | 'dimension' | 'compound' | 'power' | 'mixedFraction' | 'fraction' | 'time' | 'decimal' | 'money' | 'malformed' | 'unit' | 'roman';
/** Numerals the caller declares (whole canonical numerals only — see the header). */
export interface Ks2SayOpts { readonly roman?: readonly string[]; }
export interface Tok { readonly kind: TokKind; readonly start: number; readonly end: number; readonly raw: string; readonly spoken: string; }
// What is *not* notation: plain prose, a bare digit run (out of scope on its own — "347 + 128 = ?" is meant to
// stay "347"), a declared Roman numeral, and the idioms `ks2Say` rewrites but a raw author may still write:
// "3-digit", a price ("£3.50" — speech engines read a pound sign right, so it is converted, never refused), and
// "5²" (`sayIsSafe` catches that one through its `²` backstop). Every other kind is a span
// `ks2Say` must render and `sayIsSafe` must never find un-rendered. The table is a `Record<TokKind, boolean>`, so
// a kind added to `TokKind` does not compile until someone has decided which side it is on (#1465: the set used
// to be a list of the prose kinds and could drift).
const IS_NOTATION: Record<TokKind, boolean> = {
  text: false, digit: false, roman: false, compound: false, power: false, money: false,
  dimension: true, mixedFraction: true, fraction: true, time: true, decimal: true, malformed: true, unit: true,
};
export const NOTATION = (k: TokKind): boolean => IS_NOTATION[k];

const romanTok = (raw: string, start: number): Tok =>
  ({ kind: 'roman', start, end: start + raw.length, raw, spoken: `Roman numeral ${[...raw].join(', ')}` });

// Longest code first, so "cm²"/"cm" aren't mistaken for a shorter prefix of themselves.
const UNIT_CODES_LONGEST_FIRST = [...MULTI_LETTER_UNITS, ...SINGLE_LETTER_UNITS].sort((a, b) => b.length - a.length);
/** Greedily splits `s` into known unit codes with nothing left over — "kgcm" -> ["kg","cm"]. Returns `null`
 *  the moment a position matches no code, so an ordinary word ("Divide", "Circle" — neither has a
 *  lower-case remainder built entirely out of unit-code fragments) is never mistaken for one. */
function decomposeUnits(s: string): string[] | null {
  const lower = s.toLowerCase(); // match case-insensitively; keep `s`'s own casing in the pushed slices
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    const code = UNIT_CODES_LONGEST_FIRST.find(c => lower.startsWith(c, i));
    if (!code) return null;
    out.push(s.slice(i, i + code.length));
    i += code.length;
  }
  return out;
}

// `raw` keeps whatever case the input used (so the token's span still matches the source text exactly);
// the word lookup always runs on the lower-cased form, since `unitWord`'s tables are lower-case keyed and
// a capitalised unit code ("KG", "5 CM") is ordinary label text, not a different unit (PR #1430 round 7).
const unitTok = (raw: string, start: number, code = raw.toLowerCase()): Tok => ({ kind: 'unit', start, end: start + raw.length, raw, spoken: unitWord(code) });

/** A run of 2+ unit codes glued together with nothing else ("kgcm", "5kgcm") — PR #1430 round 8: this used
 *  to fall through to `text` and round-trip completely unconverted and unflagged. A single matched code
 *  (length 1) is deliberately excluded: a lone single-letter code still needs `singleLetterUnitOK`'s digit
 *  adjacency, checked above, and a lone multi-letter code is already caught by the direct
 *  `MULTI_LETTER_UNITS.has` check. */
function bareUnitChain(run: string, start: number): Tok[] | null {
  const chain = decomposeUnits(run);
  if (!chain || chain.length < 2) return null;
  const toks: Tok[] = [];
  let pos = start;
  for (const code of chain) { toks.push(unitTok(code, pos)); pos += code.length; }
  return toks;
}

/** A declared numeral glued to units ("Xkg", "kgX"): the numeral keeps its letters, the rest must be units. */
function gluedRoman(run: string, start: number, roman: ReadonlySet<string>): Tok[] | null {
  for (const n of roman) {
    const head = run.startsWith(n);
    if (!head && !run.endsWith(n)) continue;
    const unitsAt = head ? start + n.length : start;
    const chain = decomposeUnits(head ? run.slice(n.length) : run.slice(0, run.length - n.length));
    if (!chain) continue;
    const units = bareUnitChain(chain.join(''), unitsAt) ?? [unitTok(chain[0], unitsAt)];
    return head ? [romanTok(n, start), ...units] : [...units, romanTok(n, start + run.length - n.length)];
  }
  return null;
}

/** Splits a maximal run of letters (plus a trailing "²") into whatever it actually holds: a unit, a glued
 *  chain of units, or, for an ordinary English word (however it happens to start — "Divide", "Circle",
 *  "Xavier"), text. */
function classifyLetterRun(run: string, start: number, text: string, roman: ReadonlySet<string>): Tok[] {
  if (roman.has(run)) return [romanTok(run, start)];
  const lower = run.toLowerCase(); // unit codes match case-insensitively (#1430 round 7)
  if (MULTI_LETTER_UNITS.has(lower) || (SINGLE_LETTER_UNITS.has(lower) && singleLetterUnitOK(text, start))) {
    return [unitTok(run, start)];
  }
  // "5kgs", "20cms": a plural written with a trailing s is the same unit (#1465). Three letters or more, so a
  // two-letter run like "ms" is never read as "m" plus an s.
  if (lower.length > 2 && lower.endsWith('s') && MULTI_LETTER_UNITS.has(lower.slice(0, -1))) return [unitTok(run, start, lower.slice(0, -1))];
  // A bare chain of codes is only a chain when it is written in lower case: "Mmm, nice" is a sentence, not
  // millimetres and metres (#1465); a capitalised code beside a digit still converts, above.
  return gluedRoman(run, start, roman) ?? (run === lower ? bareUnitChain(run, start) : null)
    ?? [{ kind: 'text', start, end: start + run.length, raw: run, spoken: run }];
}

/** "£3.50" -> "three pounds fifty"; "£0.05" -> "five pence"; "£1" -> "one pound". `frac` is the digits after the point. */
function moneyWords(pounds: number, frac: string | undefined): string {
  const pence = frac === undefined ? 0 : Number(frac.padEnd(2, '0'));
  const p = pounds === 1 ? 'pound' : 'pounds';
  if (pounds === 0 && pence > 0) return `${cardinal(pence)} ${pence === 1 ? 'penny' : 'pence'}`;
  return pence === 0 ? `${cardinal(pounds)} ${p}` : `${cardinal(pounds)} ${p} ${cardinal(pence)}`;
}

/** A clock time. 24-hour unless `suffix` ("am"/"pm") says otherwise: "14:05" -> "fourteen oh five", "00:07" ->
 *  "seven minutes past midnight", "24:00" -> "midnight", "1:30pm" -> "one thirty p m". */
function timeWords(h: number, mm: number, suffix: string | undefined, padded = false): string {
  const oh = mm < 10 ? `oh ${cardinal(mm)}` : cardinal(mm);
  if (suffix) return `${cardinal(h)} ${mm === 0 ? "o'clock" : oh} ${suffix[0]} m`;
  if (h === 24 || (h === 0 && mm === 0)) return 'midnight';
  if (h === 0) return `${cardinal(mm)} minute${mm === 1 ? '' : 's'} past midnight`;
  return mm === 0 ? (h <= 12 && !padded ? `${cardinal(h)} o'clock` : `${cardinal(h)} hundred hours`) : `${cardinal(h)} ${oh}`;
}

/** What a rule finds at the front of the remaining text: the span's kind, its source text and how it is spoken. */
interface Hit { readonly kind: TokKind; readonly raw: string; readonly spoken: string }
/** A notation rule: `rest` is the text from the scan position, `before` everything ahead of it. */
type Rule = (rest: string, before: string) => Hit | null;
const hit = (kind: TokKind, m: RegExpMatchArray, spoken: string): Hit => ({ kind, raw: m[0], spoken });
const afterDigit = (before: string): boolean => /[0-9] ?$/.test(before);

// The National Curriculum's "2-D"/"3-D shape" idiom: read as "the digit, then the letter D", never as
// subtraction (`symSay`'s own hyphen-to-"minus" rule would otherwise split the digit from its D).
const dimensionRule: Rule = rest => { const m = rest.match(/^(\d+)-([Dd])\b/); return m && hit('dimension', m, `${m[1]} ${m[2]}`); };
// "3-digit", "5-minute": a digit joined to a lower-case word is a compound modifier, never subtraction (#1465).
// A run that is only unit codes ("5-cm") is left to the unit rules; a capitalised name ("10-Diego") is not a modifier.
const compoundRule: Rule = rest => {
  const m = rest.match(/^(\d+)-([a-z]{2,})\b(?!\/)/);
  if (!m) return null;
  // A hyphenated unit run ("5-kg", "5-kgs") is spoken as the quantity it is (#1992); one letter plus an s ("5-ms")
  // is no such run and stays an ordinary modifier.
  const units = decomposeUnits(m[2]) ?? (/s$/.test(m[2]) && m[2].length > 2 ? decomposeUnits(m[2].slice(0, -1)) : null);
  if (units && m[2].length > 1 && !(units.length === 1 && units[0].length === 1 && units[0] !== m[2])) {
    const words = units.map(u => unitWord(u.toLowerCase()));
    return hit('compound', m, `${m[1]} ${m[1] === '1' ? singular(words.join(' ')) : words.join(' ')}`);
  }
  return hit('compound', m, `${m[1]} ${m[2]}`);
};
// Money: "£3.50" is three pounds fifty, never "three point five zero".
const moneyRule: Rule = rest => {
  const m = rest.match(/^£(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?(?![\d]|\.\d)/);
  return m && hit('money', m, moneyWords(Number(m[1].replace(/,/g, '')), m[2]));
};
// Shapes that look like notation but are not any: "1.5.2", "3/4.5", "£3.505" (more than two decimal places is
// no price). Left raw, so `sayIsSafe` fails them.
const malformedRule: Rule = rest => {
  // "4/ 3" and "4 /3": a slash spaced on one side only is neither a tight fraction nor a division.
  const m = rest.match(/^(?:\d+(?:\.\d+){2,}|\d+\s*\/\s*\d+\.\d|£\d+\.\d{3,}|\d+ \/(?! )\d|\d+\/ \d|\d+\/\d+\/\d{4}\b|\d+\.\d\d ?[ap]m\b)/);
  return m && hit('malformed', m, m[0]);
};
// A denominator of 0 or 1 is no spoken fraction ("one first", "one zeroth") and stays raw.
const mixedRule: Rule = rest => {
  const m = rest.match(/^(\d+) (\d+)\s*\/\s*(\d+)/);
  return m && hit('mixedFraction', m, Number(m[3]) <= 1 || (Number(m[2]) >= Number(m[3]) && !m[0].includes(' /')) ? m[0] : `${cardinal(Number(m[1]))} and ${fracWord(Number(m[2]), Number(m[3]))}`);
};
// A slash with space either side after a number that is not smaller than what follows is division ("12 / 3 =
// ?"), not a fraction; an improper fraction is written tight ("7/4").
const fractionRule: Rule = rest => {
  const m = rest.match(/^(\d+)(\s*)\/(\s*)(\d+)/);
  if (!m || ((m[2] || m[3]) && Number(m[1]) >= Number(m[4]))) return null;
  return hit('fraction', m, Number(m[4]) <= 1 ? m[0] : fracWord(Number(m[1]), Number(m[4])));
};
const timeRule: Rule = rest => {
  const m = rest.match(/^(24(?=\s*:\s*00(?!\d))|[01]?\d|2[0-3])\s*:\s*([0-5]\d)(?:\s?([ap]m)\b|\b)/);
  if (!m) return null;
  const h = Number(m[1]);
  return m[3] && (h < 1 || h > 12) ? hit('malformed', m, m[0]) : hit('time', m, timeWords(h, Number(m[2]), m[3], m[1].startsWith('0')));
};
const decimalRule: Rule = rest => {
  const m = rest.match(/^(\d{1,3}(?:,\d{3})+)\.(\d+)/) ?? rest.match(/^(\d+)\.(\d+)/);
  return m && hit('decimal', m, `${cardinal(Number(m[1].replace(/,/g, '')))} point ${[...m[2]].map(c => cardinal(Number(c))).join(' ')}`);
};
// Speed: "km/h" is a unit wherever it stands; "m/s" only after a digit, as a single "m" is.
const speedRule: Rule = (rest, before) => {
  const m = rest.match(/^km\/h\b/) ?? (afterDigit(before) ? rest.match(/^m\/s(?:2(?!\d))?\b|^m\/s2(?!\d)/) : null);
  return m && hit('unit', m, /s2$/.test(m[0]) ? 'metres per second squared' : EXTRA_UNIT_WORD[m[0]]);
};
// "5 m2", "9 cm3" typed without the superscript, straight after a digit.
const asciiPowerRule: Rule = (rest, before) => {
  const m = afterDigit(before) ? rest.match(/^(cm|km|mm|m)([23])(?![0-9])/) : null;
  return m && hit('unit', m, unitWord(`${m[1]}${m[2] === '2' ? '²' : '³'}`));
};
const powerRule: Rule = rest => { const m = rest.match(/^(\d+)([²³])/); return m && hit('power', m, `${m[1]} ${m[2] === '²' ? 'squared' : 'cubed'}`); };
// Order matters: the first rule that matches claims the span. `malformedRule` goes before `decimalRule`, which would
// otherwise take the "1.5" of "1.5.2" and leave ".2" behind; the dimension and compound idioms go first because a
// digit and a hyphen are all they need. The tokenize tests pin the pairs that depend on it.
const RULES: readonly Rule[] = [dimensionRule, compoundRule, moneyRule, malformedRule, mixedRule, fractionRule, timeRule,
  decimalRule, speedRule, asciiPowerRule, powerRule];

/** One left-to-right scan claiming the longest notation match at each position; everything else is a
 *  digit run (kept bare — plain numerals are out of this module's scope) or one plain character.
 *  Exported for the tests only (the tiling and rule-order checks); callers use `ks2Say` and `sayIsSafe`. */
export function tokenize(text: string, roman: ReadonlySet<string> = new Set()): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i), before = text.slice(0, i);
    let found: Hit | null = null;
    for (const rule of RULES) { found = rule(rest, before); if (found) break; }
    const letters = found ? null : rest.match(/^[a-zA-Z]+[²³]?/);
    if (found) { toks.push({ ...found, start: i, end: i + found.raw.length }); i += found.raw.length; continue; }
    if (letters) { toks.push(...classifyLetterRun(letters[0], i, text, roman)); i += letters[0].length; continue; }
    const digits = rest.match(/^\d+/);
    const raw = digits ? digits[0] : text[i];
    toks.push({ kind: digits ? 'digit' : 'text', start: i, end: i + raw.length, raw, spoken: raw });
    i += raw.length;
  }
  return toks;
}

/**
 * Turns KS2 notation in `text` into words: a unit code, a mixed or plain fraction, a 24-hour time, a
 * decimal (read digit by digit after the point), and the NC "N-D shape" idiom. `symSay`'s operator words
 * then run over what is left. A numeral is spoken as letters only when the caller declares it in `opts.roman` (see the header).
 *
 * Also spoken (#1465): a price ("£3.50" -> "three pounds fifty"), a comma-grouped decimal, cubic and area units,
 * "km/h" and "m/s", a unit written plural or without its superscript ("5kgs", "5 m2"), "5²", a lone "1" before a
 * unit (singular), a spaced division slash, a time range, "00:07" and "24:00" (midnight), a 12-hour "1:30pm", a
 * lower-case "3-digit" compound, and `>` / `<`. **Refused, by being left raw so `sayIsSafe` says no:** a
 * denominator of 0 or 1, a malformed number ("1.5.2", "3/4.5", "£3.505"), a time that is not one ("25:10",
 * "7:5", a ratio like "3:4"), and a single-letter unit with no unit across an "=" ("2 m = 6" is an equation in m).
 *
 * Two tokens glued together with nothing between them in the input always get exactly one space between
 * their spoken forms in the output, whichever one (or both) was notation — "5kg3cm", every unit but the
 * last used to stay unconverted, now reads "5 kilograms 3 centimetres".
 *
 * Shapes this cannot resolve without context a pure string function does not have, so it does not try, and
 * neither is reachable from any real card today: "H:MM" colon notation always reads as a 24-hour time, even
 * where meant as a ratio ("mix 1:10") — no ratio topic exists in the registry today. A bare "/" or "." with
 * no digit beside it at all, from a three-or-more-fraction chain ("1/2/3/4") or a four-decimal chain
 * ("1.2.3.4"), tokenizes as two converted fractions/decimals either side of one leftover punctuation
 * character with nothing forcing them apart — "one half/three quarters" — and `sayIsSafe` cannot tell that
 * stray character from ordinary punctuation (the same reason a sentence-ending "." or a label ":" must stay
 * unflagged), so this one shape is still accepted as raw and left documented rather than "fixed" into a
 * false positive against real spoken text.
 *
 * Both this function and `sayIsSafe` normalise whitespace (`normalizeWs`) *before* tokenizing, not after —
 * PR #1430 round 9: `singleLetterUnitOK`'s digit adjacency check reads the text *around* a token's start,
 * so a double space ("5  m") used to read as "not touching" pre-conversion while `ks2Say`'s own trailing
 * whitespace collapse then closed that same gap in its output, leaving `sayIsSafe` disagreeing with itself
 * on the string it had just produced. Normalising first means both functions classify off the same
 * one-space-only adjacency every time, whatever the input's original spacing.
 */
function normalizeWs(text: string): string {
  return text.replace(/\s+/g, ' ');
}

/** The unit for exactly one of it: "kilograms" -> "kilogram" (#1465). */
const singular = (spoken: string): string => spoken.replace(/(metre|gram|litre)s\b/, '$1');

/** A unit spoken for exactly one of it ("1 kilograms" -> "1 kilogram"); a fraction right before it makes it "of a
 *  metre" ("3/4 m" -> "three quarters of a metre"); and a single-letter unit that is the only unit in a sentence
 *  with an "=" in it is left raw, because "2 m = 6" and "3m + 1 = 7" are equations in m and `sayIsSafe` should
 *  refuse them (while "3 m = ? cm" and "5 m + 3 m = 8 m" are still measurements, there being another unit). */
function unitSpoken(toks: readonly Tok[], idx: number, norm: string): string {
  const tok = toks[idx], prev = toks[idx - 1];
  if (tok.raw.length === 1 && norm.includes('=') && toks.filter(t => t.kind === 'unit').length === 1) return tok.raw;
  const before = prev?.raw === ' ' ? toks[idx - 2] : prev;
  if (before?.kind === 'fraction') return `of a ${singular(tok.spoken)}`;
  return before?.kind === 'digit' && before.raw === '1' ? singular(tok.spoken) : tok.spoken;
}

/** Plain text: a spaced slash is "divided by", a hyphen between two times is "to", `>` and `<` are spoken, the rest goes through `symSay`. */
function textSpoken(toks: readonly Tok[], idx: number, norm: string): string {
  const tok = toks[idx];
  if (tok.raw === '/' && norm[tok.start - 1] === ' ' && norm[tok.end] === ' ') return 'divided by';
  const gap = (i: number, d: number): Tok | undefined => toks[toks[i + d]?.raw === ' ' ? i + 2 * d : i + d];
  if ((tok.raw === '-' || tok.raw === '–') && gap(idx, -1)?.kind === 'time' && gap(idx, 1)?.kind === 'time') return 'to';
  if (tok.raw === '>' || tok.raw === '<') return tok.raw === '>' ? 'greater than' : 'less than';
  return tok.raw.trim() !== '' ? symSay(tok.raw) : tok.spoken;
}

const spokenIn = (toks: readonly Tok[], idx: number, norm: string): string =>
  toks[idx].kind === 'unit' ? unitSpoken(toks, idx, norm) : toks[idx].kind === 'text' ? textSpoken(toks, idx, norm) : toks[idx].spoken;

export function ks2Say(text: string, opts: Ks2SayOpts = {}): string {
  const norm = normalizeWs(text);
  // Only canonical numerals count: a declaration that is not one ("IIII", "Xavier") is ignored, not trusted.
  const roman = new Set((opts.roman ?? []).filter(n => fromRoman(n) !== null));
  const toks = tokenize(norm, roman);
  let out = '';
  let prevSpoken = '';
  toks.forEach((_tok, idx) => {
    // `symSay` runs per plain-text span, never over a notation span's own rendering — otherwise its
    // hyphen-to-"minus" rule would mangle a hyphen `ks2Say` itself just wrote ("twenty-three").
    const spoken = spokenIn(toks, idx, norm);
    // Two spans glued with nothing between them in the input get exactly one space if joining their
    // rendered forms directly would run two words/numbers together — never for ordinary trailing
    // punctuation ("5 kg," needs no space before the comma just because "kg" became "kilograms").
    if (prevSpoken && /[a-zA-Z0-9]$/.test(prevSpoken) && /^[a-zA-Z0-9]/.test(spoken)) out += ' ';
    out += spoken;
    prevSpoken = spoken;
  });
  // `symSay` can still introduce its own irregular spacing (a word substitution padded on either side), so
  // this stays as a defensive second pass — `norm` above is what classification reads, not a promise about
  // what every spoken substitution produces.
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * False while `text` still carries a notation token the tokenizer above would need to render — a fraction,
 * a decimal point between digits, a 24-hour time, a unit code, or the "N-D" idiom — plus a defensive check
 * for a stray superscript. Runs on `text` however it arrives: raw notation, or `ks2Say`'s own output, since
 * callers pass both.
 */
export function sayIsSafe(text: string): boolean {
  const norm = normalizeWs(text);
  if (norm.includes('²') || norm.includes('³')) return false;
  if (/\d ?: ?\d/.test(norm)) return false; // a colon with a digit on both sides (one optional space either
  // side, since `norm` never has more than one) is a time or ratio the tokenizer's time token did not match, so
  // this stays as a direct backstop; a label colon ("Solve: 3 + 4") has a digit on one side only and passes
  const toks = tokenize(norm);
  return toks.every(t => !NOTATION(t.kind));
}

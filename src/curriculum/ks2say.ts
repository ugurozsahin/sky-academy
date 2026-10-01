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
  'cm²': 'square centimetres', 'm²': 'square metres', km: 'kilometres', mm: 'millimetres', mg: 'milligrams',
};
const unitWord = (u: string): string => EXTRA_UNIT_WORD[u] ?? UNIT_WORD[u] ?? u;
// A multi-letter unit code is unambiguous wherever it stands alone (no ordinary KS2 word is exactly "kg"
// or "cm²"), so it is always notation. "m"/"g"/"l" alone are also real algebra variables, so they only
// count as notation immediately after a digit — see `singleLetterUnitOK`.
const MULTI_LETTER_UNITS = new Set(['cm²', 'm²', 'km', 'mm', 'ml', 'mg', 'kg', 'cm']);
const SINGLE_LETTER_UNITS = new Set(['m', 'g', 'l']);
const singleLetterUnitOK = (text: string, start: number): boolean => /[0-9] ?$/.test(text.slice(0, start));

type TokKind = 'text' | 'digit' | 'dimension' | 'mixedFraction' | 'fraction' | 'time' | 'decimal' | 'unit' | 'roman';
/** Numerals the caller declares (whole canonical numerals only — see the header). */
export interface Ks2SayOpts { readonly roman?: readonly string[]; }
interface Tok { readonly kind: TokKind; readonly start: number; readonly end: number; readonly raw: string; readonly spoken: string; }
// Everything but plain prose and a bare digit run (out of scope on its own — "347 + 128 = ?" is meant to
// stay "347") is a span `ks2Say` must render and `sayIsSafe` must never find un-rendered.
const NOTATION: ReadonlySet<TokKind> = new Set(['dimension', 'mixedFraction', 'fraction', 'time', 'decimal', 'unit']);

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
const unitTok = (raw: string, start: number): Tok => ({ kind: 'unit', start, end: start + raw.length, raw, spoken: unitWord(raw.toLowerCase()) });

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
  return gluedRoman(run, start, roman) ?? bareUnitChain(run, start)
    ?? [{ kind: 'text', start, end: start + run.length, raw: run, spoken: run }];
}

/** One left-to-right scan claiming the longest notation match at each position; everything else is a
 *  digit run (kept bare — plain numerals are out of this module's scope) or one plain character. */
function tokenize(text: string, roman: ReadonlySet<string> = new Set()): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    let m: RegExpMatchArray | null;
    // The National Curriculum's "2-D"/"3-D shape" idiom: read as "the digit, then the letter D", never as
    // subtraction (`symSay`'s own hyphen-to-"minus" rule would otherwise split the digit from its D).
    if ((m = rest.match(/^(\d+)-([Dd])\b/))) {
      toks.push({ kind: 'dimension', start: i, end: i + m[0].length, raw: m[0], spoken: `${m[1]} ${m[2]}` });
      i += m[0].length; continue;
    }
    if ((m = rest.match(/^(\d+) (\d+)\s*\/\s*(\d+)/))) {
      const spoken = `${cardinal(Number(m[1]))} and ${fracWord(Number(m[2]), Number(m[3]))}`;
      toks.push({ kind: 'mixedFraction', start: i, end: i + m[0].length, raw: m[0], spoken });
      i += m[0].length; continue;
    }
    if ((m = rest.match(/^(\d+)\s*\/\s*(\d+)/))) {
      toks.push({ kind: 'fraction', start: i, end: i + m[0].length, raw: m[0], spoken: fracWord(Number(m[1]), Number(m[2])) });
      i += m[0].length; continue;
    }
    if ((m = rest.match(/^([01]?\d|2[0-3])\s*:\s*([0-5]\d)\b/))) {
      const mm = Number(m[2]);
      const spoken = mm === 0 ? `${cardinal(Number(m[1]))} hundred hours`
        : `${cardinal(Number(m[1]))} ${mm < 10 ? `oh ${cardinal(mm)}` : cardinal(mm)}`;
      toks.push({ kind: 'time', start: i, end: i + m[0].length, raw: m[0], spoken });
      i += m[0].length; continue;
    }
    if ((m = rest.match(/^(\d+)\.(\d+)/))) {
      const spoken = `${cardinal(Number(m[1]))} point ${[...m[2]].map(c => cardinal(Number(c))).join(' ')}`;
      toks.push({ kind: 'decimal', start: i, end: i + m[0].length, raw: m[0], spoken });
      i += m[0].length; continue;
    }
    if ((m = rest.match(/^[a-zA-Z]+²?/))) {
      for (const tok of classifyLetterRun(m[0], i, text, roman)) toks.push(tok);
      i += m[0].length; continue;
    }
    if ((m = rest.match(/^\d+/))) {
      toks.push({ kind: 'digit', start: i, end: i + m[0].length, raw: m[0], spoken: m[0] });
      i += m[0].length; continue;
    }
    toks.push({ kind: 'text', start: i, end: i + 1, raw: text[i], spoken: text[i] });
    i += 1;
  }
  return toks;
}

/**
 * Turns KS2 notation in `text` into words: a unit code, a mixed or plain fraction, a 24-hour time, a
 * decimal (read digit by digit after the point), and the NC "N-D shape" idiom. `symSay`'s operator words
 * then run over what is left. A numeral is spoken as letters only when the caller declares it in `opts.roman` (see the header).
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

export function ks2Say(text: string, opts: Ks2SayOpts = {}): string {
  const norm = normalizeWs(text);
  // Only canonical numerals count: a declaration that is not one ("IIII", "Xavier") is ignored, not trusted.
  const roman = new Set((opts.roman ?? []).filter(n => fromRoman(n) !== null));
  const toks = tokenize(norm, roman);
  let out = '';
  let prevSpoken = '';
  for (const tok of toks) {
    // `symSay` runs per plain-text span, never over a notation span's own rendering — otherwise its
    // hyphen-to-"minus" rule would mangle a hyphen `ks2Say` itself just wrote ("twenty-three").
    const spoken = tok.kind === 'text' && tok.raw.trim() !== '' ? symSay(tok.raw) : tok.spoken;
    // Two spans glued with nothing between them in the input get exactly one space if joining their
    // rendered forms directly would run two words/numbers together — never for ordinary trailing
    // punctuation ("5 kg," needs no space before the comma just because "kg" became "kilograms").
    if (prevSpoken && /[a-zA-Z0-9]$/.test(prevSpoken) && /^[a-zA-Z0-9]/.test(spoken)) out += ' ';
    out += spoken;
    prevSpoken = spoken;
  }
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
  if (norm.includes('²')) return false;
  if (/\d ?: ?\d/.test(norm)) return false; // a colon with a digit on both sides (one optional space either
  // side, since `norm` never has more than one) is a time or ratio the tokenizer's time token did not match, so
  // this stays as a direct backstop; a label colon ("Solve: 3 + 4") has a digit on one side only and passes
  const toks = tokenize(norm);
  return toks.every(t => !NOTATION.has(t.kind));
}

// Spoken forms for KS2 notation (#1057). A speech engine reads written maths wrong, or gives the answer
// away — "3/4" can sound like a date, "3.75" like "three seventy-five", "XIV" like the answer on a card
// that asks what XIV means. `ks2Say` turns it into words a teacher would say; `sayIsSafe` proves none of
// it is left. `util.ts` (its own line cap) stays untouched: this runs `symSay` first, then its own passes.
import { fromRoman } from './roman';
import { symSay, UNIT_WORD } from './util';

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** Cardinal number word, any non-negative integer — the decimal/mixed-fraction whole part below can run
 *  into the hundreds or thousands (a KS2 money or measurement value), not just an hour or a minute. */
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
  const thousands = Math.floor(n / 1000), rest = n % 1000;
  return rest === 0 ? `${cardinal(thousands)} thousand` : `${cardinal(thousands)} thousand ${cardinal(rest)}`;
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
    if (rest === 0) return hundreds === 1 ? 'hundredth' : `${ONES[hundreds]} hundredth`;
    return `${ONES[hundreds]} hundred and ${ordinalWord(rest)}`;
  }
  const thousands = Math.floor(n / 1000), rest = n % 1000;
  if (rest === 0) return thousands === 1 ? 'thousandth' : `${cardinal(thousands)} thousandth`;
  return `${cardinal(thousands)} thousand ${ordinalWord(rest)}`;
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
// A unit code only counts right after a digit (a bare algebra letter like "m" is never mistaken for one).
// Longer codes first in the alternation, so "cm²"/"mm"/"ml"/"mg" win over "cm"/"m"/"g" at the same spot.
const UNIT_ALT = 'cm²|m²|km|mm|ml|mg|kg|cm|m|g|l';
const UNIT_RE = new RegExp(`(\\d)( ?)(${UNIT_ALT})(?![a-zA-Z0-9²])`, 'g');
/** `UNIT_RE` with no capture groups/`g` flag: does `text` carry one, whatever produced it? */
const UNIT_LEFT_RE = new RegExp(`\\d ?(?:${UNIT_ALT})(?![a-zA-Z0-9²])`);
// Once a number is fully spelled out there is no digit left for UNIT_LEFT_RE to anchor on ("three point
// five kg" has none next to "kg"), so a *multi-letter* code is flagged unconditionally instead — unlike a
// bare "m"/"g"/"l" (a real algebra variable), none of these is an ordinary English word or variable name.
const UNIT_BARE_RE = /(?<![a-zA-Z0-9])(?:cm²|m²|km|mm|ml|mg|kg|cm)(?![a-zA-Z0-9²])/;

/**
 * Turns KS2 notation in `text` into words: `symSay`'s operators, then a unit code (run early, on the raw
 * digit, since the fraction/decimal passes below turn that same digit into words first otherwise — "3.5
 * kg" or "3/4 m" would reach a speech engine with the abbreviation left unconverted), a Roman numeral
 * (spelled out letter by letter, never read as its value — a card asking what XIV *means* must not say the
 * answer), a mixed or plain fraction, a 24-hour time, and a decimal (read digit by digit after the point).
 *
 * Two shapes this cannot resolve without context a pure string function does not have, so it does not try:
 * an ordinary word that happens to be a canonical Roman numeral ("MIX", "XL") reads as one outside the one
 * carved-out case ("I", the pronoun); and "H:MM" always reads as a time, even as a ratio ("mix 1:10") — no
 * ratio topic exists in the registry today, so this is not yet reachable from any real card.
 */
export function ks2Say(text: string): string {
  const hadLowerCase = /[a-z]/.test(text); // checked before symSay adds its own lower-case operator words
  let out = symSay(text);
  out = out.replace(UNIT_RE, (_, digit, space, unit) => `${digit}${space}${unitWord(unit)}`);
  out = out.replace(/\b[IVXLCDM]+\b/g, tok => {
    if (tok === 'I' && hadLowerCase) return tok; // the pronoun "I" in an ordinary sentence, left alone
    return fromRoman(tok) === null ? tok : `Roman numeral ${tok.split('').join(', ')}`;
  });
  out = out.replace(/(\d+) (\d+)\/(\d+)/g, (_, w, n, d) => `${cardinal(Number(w))} and ${fracWord(Number(n), Number(d))}`);
  out = out.replace(/(\d+)\/(\d+)/g, (_, n, d) => fracWord(Number(n), Number(d)));
  out = out.replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g, (_, h, m) => {
    const mm = Number(m);
    if (mm === 0) return `${cardinal(Number(h))} hundred hours`;
    return `${cardinal(Number(h))} ${mm < 10 ? `oh ${cardinal(mm)}` : cardinal(mm)}`;
  });
  out = out.replace(/(\d+)\.(\d+)/g, (_, i, f) => `${cardinal(Number(i))} point ${[...f].map(c => cardinal(Number(c))).join(' ')}`);
  return out.replace(/\s+/g, ' ').trim();
}

/** False while `text` still carries raw notation a speech engine would misread: a fraction, a decimal point
 *  between digits, a 24-hour time, a superscript, a digit-adjacent unit code, or a canonical Roman numeral
 *  of two or more letters (a lone "I" is never flagged — as likely the pronoun as the numeral). */
export function sayIsSafe(text: string): boolean {
  if (/\d+\/\d+/.test(text)) return false;
  if (/\d\.\d/.test(text)) return false;
  if (/\d:\d\d/.test(text)) return false;
  if (text.includes('²')) return false;
  if (UNIT_LEFT_RE.test(text) || UNIT_BARE_RE.test(text)) return false;
  for (const tok of text.match(/\b[IVXLCDM]{2,}\b/g) ?? []) if (fromRoman(tok) !== null) return false;
  return true;
}

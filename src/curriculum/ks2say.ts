// Spoken forms for KS2 notation (#1057). A speech engine reads written maths wrong, or gives the answer
// away — "3/4" can sound like a date, "3.75" like "three seventy-five", "XIV" like the answer on a card
// that asks what XIV means. `ks2Say` turns KS2 notation into words a teacher would say; `sayIsSafe` proves
// none of that notation is still there. `util.ts` stays untouched (it is at its own line cap): this file
// runs `symSay` first, then layers its own replacements on top.
import { fromRoman } from './roman';
import { symSay, UNIT_WORD } from './util';

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** Cardinal number word, 0-99 (enough for a digit, an hour 0-23 or a minute 0-59). */
function cardinal(n: number): string {
  if (n < 20) return ONES[n];
  const tens = Math.floor(n / 10), ones = n % 10;
  return ones === 0 ? TENS[tens] : `${TENS[tens]}-${ONES[ones]}`;
}

const DENOM_WORD: Record<number, string> = {
  2: 'half', 3: 'third', 4: 'quarter', 5: 'fifth', 6: 'sixth', 7: 'seventh', 8: 'eighth',
  9: 'ninth', 10: 'tenth', 11: 'eleventh', 12: 'twelfth', 100: 'hundredth',
};
const denomWord = (d: number): string => DENOM_WORD[d] ?? `${cardinal(d)}th`;
/** "3/4" -> "three quarters", "1/2" -> "one half" (the one irregular plural). */
function fracWord(n: number, d: number): string {
  const denom = denomWord(d);
  const plural = n === 1 ? denom : denom === 'half' ? 'halves' : `${denom}s`;
  return `${cardinal(Math.abs(n))} ${plural}`;
}

/** cm²/m² and km are not in `UNIT_WORD` (util.ts:211); everything else — cm, m, g, ml, kg, l — is. */
const EXTRA_UNIT_WORD: Record<string, string> = { 'cm²': 'square centimetres', 'm²': 'square metres', km: 'kilometres' };
const unitWord = (u: string): string => EXTRA_UNIT_WORD[u] ?? UNIT_WORD[u] ?? u;
// A unit code only counts right after a digit (an optional single space between), so a bare algebra
// letter such as "m" or "l" is never mistaken for a unit — the longer codes come first so "cm²" and "km"
// win over "cm" and "m" at the same position.
const UNIT_RE = /(\d)( ?)(cm²|m²|km|ml|kg|cm|m|g|l)(?![a-zA-Z0-9²])/g;

/**
 * Turns KS2 notation in `text` into words: `symSay`'s operators first, then a Roman numeral (spelled out
 * letter by letter, never read as its value — a card asking what XIV *means* must not say the answer), a
 * mixed or plain fraction, a 24-hour time, a decimal (read digit by digit after the point, so no float
 * ever needs rounding for speech), and a unit code. Order matters: fractions and times are read out of the
 * digits directly, so they run before the decimal scan would otherwise claim the same digits; units run
 * last, once every other digit run has already been turned into words.
 */
export function ks2Say(text: string): string {
  const hadLowerCase = /[a-z]/.test(text); // checked before symSay adds its own lower-case operator words
  let out = symSay(text);
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
  out = out.replace(UNIT_RE, (_, digit, space, unit) => `${digit}${space}${unitWord(unit)}`);
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * False while `text` still carries raw KS2 notation a speech engine would misread: a fraction, a decimal
 * point between digits, a 24-hour time, a superscript ("cm²"/"m²"), or a canonical Roman numeral of two or
 * more letters (a lone "I" is never flagged — it is as likely the pronoun as the numeral).
 */
export function sayIsSafe(text: string): boolean {
  if (/\d+\/\d+/.test(text)) return false;
  if (/\d\.\d/.test(text)) return false;
  if (/\d:\d\d/.test(text)) return false;
  if (text.includes('²')) return false;
  for (const tok of text.match(/\b[IVXLCDM]{2,}\b/g) ?? []) if (fromRoman(tok) !== null) return false;
  return true;
}

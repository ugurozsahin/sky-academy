// Spoken forms for KS2 notation (#1057). A speech engine reads written maths wrong, or gives the answer
// away — "3/4" can sound like a date, "3.75" like "three seventy-five", "XIV" like the answer on a card
// that asks what XIV means. `ks2Say` turns it into words a teacher would say; `sayIsSafe` proves none of
// it is left. `util.ts` (its own line cap) stays untouched: `symSay`'s operator words still run, but only
// over the plain characters the tokenizer below leaves as ordinary text — never over a notation span.
//
// Both functions walk the same left-to-right tokenizer (`tokenize`) instead of two hand-maintained regex
// sets. Six review rounds on PR #1430 found a recurring class of bug: a `ks2Say` conversion pass and the
// `sayIsSafe` check meant to catch what it missed disagreed about where one piece of notation ends and
// the next begins, because each was a separate regex free to define "adjacent" its own way. A shared
// tokenizer removes the seam — `ks2Say` renders every non-prose token it finds, `sayIsSafe` fails whenever
// one is left un-rendered — so the two structurally cannot drift apart, unlike the six rounds of
// independently-drifting regexes they replace.
import { fromRoman } from './roman';
import { symSay, UNIT_WORD } from './util';

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
// count as notation touching a digit or a Roman numeral — see `singleLetterUnitOK`.
const MULTI_LETTER_UNITS = new Set(['cm²', 'm²', 'km', 'mm', 'ml', 'mg', 'kg', 'cm']);
const SINGLE_LETTER_UNITS = new Set(['m', 'g', 'l']);
const singleLetterUnitOK = (text: string, start: number): boolean => /(?:[0-9]|[IVXLCDM]) ?$/.test(text.slice(0, start));

type TokKind = 'text' | 'digit' | 'dimension' | 'mixedFraction' | 'fraction' | 'time' | 'decimal' | 'roman' | 'unit';
interface Tok { readonly kind: TokKind; readonly start: number; readonly end: number; readonly raw: string; readonly spoken: string; }
// Everything but plain prose and a bare digit run (out of scope on its own — "347 + 128 = ?" is meant to
// stay "347") is a span `ks2Say` must render and `sayIsSafe` must never find un-rendered.
const NOTATION: ReadonlySet<TokKind> = new Set(['dimension', 'mixedFraction', 'fraction', 'time', 'decimal', 'roman', 'unit']);

// Longest code first, so "cm²"/"cm" aren't mistaken for a shorter prefix of themselves.
const UNIT_CODES_LONGEST_FIRST = [...MULTI_LETTER_UNITS, ...SINGLE_LETTER_UNITS].sort((a, b) => b.length - a.length);
/** Greedily splits `s` into known unit codes with nothing left over — "kgcm" -> ["kg","cm"], the chain a
 *  Roman-numeral prefix can be glued to with no separators at all ("Xkgcm", PR #1430 round 3). Returns
 *  `null` the moment a position matches no code, so an ordinary word ("Divide", "Circle" — neither has a
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

const romanTok = (raw: string, start: number): Tok =>
  ({ kind: 'roman', start, end: start + raw.length, raw, spoken: `Roman numeral ${raw.split('').join(', ')}` });
// `raw` keeps whatever case the input used (so the token's span still matches the source text exactly);
// the word lookup always runs on the lower-cased form, since `unitWord`'s tables are lower-case keyed and
// a capitalised unit code ("KG", "5 CM") is ordinary label text, not a different unit (PR #1430 round 7).
const unitTok = (raw: string, start: number): Tok => ({ kind: 'unit', start, end: start + raw.length, raw, spoken: unitWord(raw.toLowerCase()) });

/** An upper-case canonical Roman-numeral prefix glued straight to a chain of lower-case unit codes with
 *  no space ("Icm", "IIkg", "Xkgcm" — PR #1430 rounds 3 and 5) — `null` for anything else, ordinary words
 *  ("Divide", "Circle") included, since their lower-case remainder is never built entirely out of
 *  unit-code fragments. */
// Lower-case `i`/`v`/`x`/`d` fold to their upper-case reading here (PR #1430 round 8: "xkg", "5kgv") because
// no unit code starts with any of the four — `c`/`m`/`l` deliberately stay upper-case-only, since those
// *are* unit-code initials ("cm", "m", "l") and folding them would swallow a unit's own first letter into
// a longer, wrong Roman-numeral guess ("Icm" misread two letters deep instead of "I" + "cm").
function romanThenUnits(run: string, start: number): Tok[] | null {
  const upper = run.match(/^[IVXLCDMivxd]+/)?.[0];
  if (!upper || fromRoman(upper.toUpperCase()) === null) return null;
  const chain = decomposeUnits(run.slice(upper.length));
  if (!chain) return null;
  const toks = [romanTok(upper, start)];
  let pos = start + upper.length;
  for (const code of chain) { toks.push(unitTok(code, pos)); pos += code.length; }
  return toks;
}

/** Greedily consumes as many unit codes as will match from the start of `s`, stopping the moment none
 *  does — unlike `decomposeUnits`, leftover is expected here, since what follows is a Roman-numeral
 *  suffix, not more unit codes. */
function consumeUnitChainPrefix(s: string): { chain: string[]; rest: string } {
  const lower = s.toLowerCase(); // match case-insensitively; keep `s`'s own casing in the pushed slices
  const chain: string[] = [];
  let i = 0;
  for (let code; (code = UNIT_CODES_LONGEST_FIRST.find(c => lower.startsWith(c, i)));) { chain.push(s.slice(i, i + code.length)); i += code.length; }
  return { chain, rest: s.slice(i) };
}

/** The mirror image of `romanThenUnits` — a *chain* of unit codes glued straight to a Roman-numeral
 *  suffix ("kgX", "kgcmX"), rather than before it. A run can never satisfy both this and `romanThenUnits`
 *  at once (each requires the *other* reading to fail first at the run's one boundary), so the two are
 *  never ambiguous against each other. */
function unitThenRoman(run: string, start: number): Tok[] | null {
  const { chain, rest } = consumeUnitChainPrefix(run);
  if (chain.length === 0 || !rest || !/^[IVXLCDMivxd]+$/.test(rest) || fromRoman(rest.toUpperCase()) === null) return null;
  const toks: Tok[] = [];
  let pos = start;
  for (const code of chain) { toks.push(unitTok(code, pos)); pos += code.length; }
  toks.push(romanTok(rest, pos));
  return toks;
}

/** A run of 2+ unit codes glued together with nothing else and no Roman-numeral anchor on either side
 *  ("kgcm", "5kgcm") — `decomposeUnits` already recognises this chain shape when a Roman numeral sits next
 *  to it (`romanThenUnits`/`unitThenRoman` below); this is the same chain with no such neighbour, which
 *  neither of those two require in the first place (PR #1430 round 8 — this used to fall through to `text`
 *  and round-trip completely unconverted and unflagged). A single matched code (length 1) is deliberately
 *  excluded: a lone single-letter code still needs `singleLetterUnitOK`'s digit/Roman adjacency, checked
 *  above, and a lone multi-letter code is already caught by the direct `MULTI_LETTER_UNITS.has` check. */
function bareUnitChain(run: string, start: number): Tok[] | null {
  const chain = decomposeUnits(run);
  if (!chain || chain.length < 2) return null;
  const toks: Tok[] = [];
  let pos = start;
  for (const code of chain) { toks.push(unitTok(code, pos)); pos += code.length; }
  return toks;
}

/** Splits a maximal run of letters (plus a trailing "²") into whatever it actually holds: a unit, a Roman
 *  numeral, one of the two glued combinations above, or, for an ordinary English word (however it happens
 *  to start — "Divide", "Circle", "Xavier"), text. */
function classifyLetterRun(run: string, start: number, text: string): Tok[] {
  const lower = run.toLowerCase(); // unit codes match case-insensitively (#1430 round 7); the Roman check
  // below stays case-sensitive on purpose — "m" alone is the letter, never lower-case "d" for 500.
  if (MULTI_LETTER_UNITS.has(lower) || (SINGLE_LETTER_UNITS.has(lower) && singleLetterUnitOK(text, start))) {
    return [unitTok(run, start)];
  }
  if (/^[IVXLCDM]+$/.test(run) && fromRoman(run) !== null) return [romanTok(run, start)];
  return bareUnitChain(run, start) ?? romanThenUnits(run, start) ?? unitThenRoman(run, start)
    ?? [{ kind: 'text', start, end: start + run.length, raw: run, spoken: run }];
}

/** One left-to-right scan claiming the longest notation match at each position; everything else is a
 *  digit run (kept bare — plain numerals are out of this module's scope) or one plain character. Because
 *  digit runs and letter runs are different token classes here, "X5" is a Roman numeral immediately
 *  followed by a digit, not one `\w`-boundary-proof blob the way `\b`-based regexes saw it. */
function tokenize(text: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    let m: RegExpMatchArray | null;
    // The National Curriculum's "2-D"/"3-D shape" idiom: read as "the digit, then the letter D", never as
    // subtraction-then-a-Roman-numeral-D (`symSay`'s own hyphen-to-"minus" rule would otherwise free that
    // bare D to be read as the Roman numeral 500 the moment the hyphen splits it off, #1430 round 6).
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
      for (const tok of classifyLetterRun(m[0], i, text)) toks.push(tok);
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

// Ordinary sentence/list punctuation that may legitimately sit right against a bare Roman numeral with no
// space — the comma `ks2Say`'s own "Roman numeral X, I, V" rendering puts after one mid-run, and whatever
// a sentence around a *standalone* numeral ends or pauses on ("List the numerals I, V, X.", "Numeral I?").
// Never ":" or "/" — those are exactly the shapes rounds 4-5 needed flagged (a colon or slash is itself
// notation a bare numeral could be mistaken for the edge of).
const SAFE_ROMAN_NEIGHBOUR = new Set([' ', ',', '.', '?', '!']);
/** True when a single-letter Roman numeral touches, with no space, anything but the punctuation above —
 *  used by the "I"-pronoun decision: a genuinely glued "I" ("I/2") is never the pronoun, whatever the rest
 *  of the string reads like (PR #1430 round 7). */
function isGlued(tok: Tok, text: string): boolean {
  const before = text[tok.start - 1], after = text[tok.end];
  const gluedBefore = before !== undefined && !SAFE_ROMAN_NEIGHBOUR.has(before);
  const gluedAfter = after !== undefined && !SAFE_ROMAN_NEIGHBOUR.has(after);
  return gluedBefore || gluedAfter;
}

/** A lone "I" reads as the pronoun rather than the numeral only when the *surrounding text as a whole*
 *  has ordinary prose in it (`hadLowerCase`) *and this specific occurrence* isn't itself glued to
 *  anything — a global "does this text have any real prose" flag applied to every bare "I" regardless of
 *  its own neighbours let a genuinely separate, glued leftover ("I think the ratio is I/2 to check.") hide
 *  behind an unrelated pronoun earlier in the same sentence (PR #1430 round 7). */
const isPronounI = (tok: Tok, text: string, hadLowerCase: boolean): boolean =>
  tok.kind === 'roman' && tok.raw === 'I' && hadLowerCase && !isGlued(tok, text);

/**
 * Turns KS2 notation in `text` into words: a unit code, a Roman numeral (spelled out letter by letter,
 * never read as its value — a card asking what XIV *means* must not say the answer), a mixed or plain
 * fraction, a 24-hour time, a decimal (read digit by digit after the point), and the NC "N-D shape" idiom.
 * A lone "I" is treated as the pronoun unless the surrounding text has no lower-case prose in it at all
 * (bare notation, not a sentence). `symSay`'s operator words then run over what is left.
 *
 * Two tokens glued together with nothing between them in the input always get exactly one space between
 * their spoken forms in the output, whichever one (or both) was notation — the same "5kg3cm" chain that
 * used to leave every unit but the last unconverted now reads "5 kilograms 3 centimetres".
 *
 * Shapes this cannot resolve without context a pure string function does not have, so it does not try —
 * neither reachable from any real card today: an ordinary English word that happens to be a canonical
 * Roman numeral ("MIX", "XL") still reads as one outside the one carved-out case ("I", the pronoun); and
 * "H:MM" colon notation always reads as a 24-hour time, even where meant as a ratio ("mix 1:10") — no
 * ratio topic exists in the registry today. A bare "/" or "." with no digit beside it at all, from a
 * three-or-more-fraction chain ("1/2/3/4") or a four-decimal chain ("1.2.3.4"), tokenizes as two converted
 * fractions/decimals either side of one leftover punctuation character with nothing forcing them apart —
 * "one half/three quarters" — and `sayIsSafe` cannot tell that stray character from ordinary punctuation
 * (the same reason a sentence-ending "." or a label ":" must stay unflagged), so this one shape is still
 * accepted as raw and left documented rather than "fixed" into a false positive against real spoken text.
 *
 * Both this function and `sayIsSafe` normalise whitespace (`normalizeWs`) *before* tokenizing, not after —
 * PR #1430 round 9: `singleLetterUnitOK`'s digit/Roman adjacency check reads the text *around* a token's
 * start, so a double space ("5  m") used to read as "not touching" pre-conversion while `ks2Say`'s own
 * trailing whitespace collapse then closed that same gap in its output, leaving `sayIsSafe` disagreeing
 * with itself on the string it had just produced. Normalising first means both functions classify off the
 * same one-space-only adjacency every time, whatever the input's original spacing.
 */
function normalizeWs(text: string): string {
  return text.replace(/\s+/g, ' ');
}

export function ks2Say(text: string): string {
  const norm = normalizeWs(text);
  const toks = tokenize(norm);
  // A raw unit or Roman-numeral token supplies letters of its own that must not count as "ordinary prose"
  // when deciding whether a lone "I" is the pronoun or the numeral — only a genuine word (a `text` token)
  // does. "I kg", "Icm" are bare notation either way; "I weigh 5 kg, I think" has real prose alongside it.
  const hadLowerCase = toks.some(t => t.kind === 'text' && /[a-z]/.test(t.raw));
  let out = '';
  let prevSpoken = '';
  for (const tok of toks) {
    // `symSay` runs per plain-text span, never over a notation span's own rendering — otherwise its
    // hyphen-to-"minus" rule would mangle a hyphen `ks2Say` itself just wrote ("twenty-three").
    const isPronoun = isPronounI(tok, norm, hadLowerCase);
    const spoken = isPronoun ? 'I' : tok.kind === 'text' && tok.raw.trim() !== '' ? symSay(tok.raw) : tok.spoken;
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

// `romanTok` always renders as `Roman numeral <raw>`, its letters joined by ", " when `raw` is 2+ long
// (`raw.split('').join(', ')`); `dimension`'s own `spoken` (the "N-D shape" idiom) renders as bare
// "<digits> D" with no such prefix. These are the only two shapes `ks2Say`'s own output ever leaves a
// bare Roman-numeral-shaped letter in. Re-tokenizing that output finds those same letters again, so
// `sayIsSafe` must tell "already spelled out by `ks2Say`" apart from "still raw" some other way than the
// letter itself, which reads identically either way.
// `\b` after each letter matters: without it, "Roman numeral V, Roman numeral X" lets ", R" (the *next*
// phrase's own "Roman") be mistaken for another bare single-letter numeral, over-extending the match into
// the following word and losing the real boundary between two separately-rendered numerals.
const ALREADY_SPOKEN_ROMAN = /Roman numeral [A-Za-z]\b(?:, [A-Za-z]\b)*/g;
const ALREADY_SPOKEN_DIMENSION = /\d+ [Dd]\b/g;
/** The character span(s) of a `Roman numeral …`/dimension rendering's own letters — *not* a defensive
 *  "was this glued to something else" check, only where the template itself puts a letter. A matched
 *  `Roman numeral …` run that is itself glued to something unsafe right outside it (the digit-orphan and
 *  colon-between-numerals regressions, PR #1430 round 9 fixing) still needs catching, so the caller applies
 *  `isGlued`-style neighbour checks around the *whole* span, not just membership in it. */
function alreadySpokenSpans(text: string): Array<readonly [number, number, boolean]> {
  const roman = [...text.matchAll(ALREADY_SPOKEN_ROMAN)].map(m => [m.index!, m.index! + m[0].length, true] as const);
  const dim = [...text.matchAll(ALREADY_SPOKEN_DIMENSION)]
    .map(m => [m.index! + m[0].length - 1, m.index! + m[0].length, false] as const); // just the D/d itself
  return [...roman, ...dim];
}
/** A rendered span is only genuinely safe when nothing unsafe is glued right outside it too — "Roman
 *  numeral V/2" (a fraction glued straight onto the numeral with no separator) must still fail, the same
 *  way a raw glued Roman letter must (PR #1430 round 9, the digit-orphan and colon-between-numerals
 *  regressions this fix introduced on its first pass). The dimension idiom's own `\b` already rules out
 *  being glued to a following word character, so only the Roman-numeral spans need the outer check. */
function spanIsGlued(start: number, end: number, checkBoundary: boolean, text: string): boolean {
  if (!checkBoundary) return false;
  const before = text[start - 1], after = text[end];
  return (before !== undefined && !SAFE_ROMAN_NEIGHBOUR.has(before)) ||
    (after !== undefined && !SAFE_ROMAN_NEIGHBOUR.has(after));
}

/**
 * False while `text` still carries a notation token the tokenizer above would need to render — a fraction,
 * a decimal point between digits, a 24-hour time, a unit code, a Roman numeral, or the "N-D" idiom — plus a
 * defensive check for a stray superscript. Runs on `text` however it arrives: raw notation, or `ks2Say`'s
 * own output, since callers pass both.
 *
 * Every `NOTATION` kind is unsafe whenever the tokenizer finds one, `roman` included, *except* a letter that
 * sits inside a rendering `ks2Say` itself would just have produced (a `Roman numeral X[, Y...]` span, or the
 * bare "<digits> D" the "N-D shape" idiom leaves) and that rendering is not itself glued to something else
 * unsafe — PR #1430 round 9 finding 2: a standalone, unglued Roman letter other than "I" ("Choose V or X")
 * was wrongly treated the same as one `ks2Say` had already spelled out, because the old check asked only
 * whether the letter was glued, never whether it was *already rendered*. A letter is either one or the
 * other; nothing in real prose puts the literal phrase "Roman numeral" directly before a bare notation
 * letter by coincidence, so this reads as "was this produced by this module", not a content guess.
 */
export function sayIsSafe(text: string): boolean {
  const norm = normalizeWs(text);
  if (norm.includes('²')) return false;
  if (/\d ?:|: ?\d/.test(norm)) return false; // digit-adjacent colon (one optional space either side, since
  // `norm` never has more than one) that isn't a valid 24-hour time is not matched by the tokenizer's time
  // token, so this stays as a direct backstop
  const toks = tokenize(norm);
  const hadLowerCase = toks.some(t => t.kind === 'text' && /[a-z]/.test(t.raw));
  const spoken = alreadySpokenSpans(norm);
  for (const tok of toks) {
    if (isPronounI(tok, norm, hadLowerCase)) continue; // the pronoun, not the numeral
    if (tok.kind === 'roman' &&
      spoken.some(([s, e, checkBoundary]) => tok.start >= s && tok.end <= e && !spanIsGlued(s, e, checkBoundary, norm))) continue;
    if (NOTATION.has(tok.kind)) return false;
  }
  return true;
}

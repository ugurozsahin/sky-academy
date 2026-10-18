/**
 * A pin that holds a whole sentence, not a substring of one (#771, owner's scoping decision 2026-10-12).
 *
 * The class this closes: a `.toMatch(/…/)`/`.toContain('…')` pin covers a clause's text but has no
 * end-of-sentence anchor, so a rewrite can append a hedge *inside* the sentence — "…every topic, every
 * spelling, every route — though not every one needs listing." — and every pin on it stays green while the
 * rule is gutted. PR #814 end-anchored four such pins by hand with `\.` in the regex; this is that fix as a
 * helper, so the next pin gets it by using the helper rather than by remembering the trick.
 *
 * `pinSentence(text, fragment)` throws unless **all** of:
 *  1. `fragment` occurs in `text` **exactly once** (a second copy is a decoy — `add-guard-rail` §6);
 *  2. from the end of the fragment to the end of its sentence there is nothing but whitespace, where a
 *     sentence ends at `.`, `!` or `?` followed by whitespace or the end of the text (a closing `**`, `)`,
 *     `]`, `"`, `'` or backtick may sit between the two), at a blank line, or at the end of the text. A
 *     fragment that itself ends with such a terminator has closed its own sentence, so only closers and
 *     whitespace may follow it. **`;` and `:` are not sentence ends**: the member-2 attack in #771 is a hedge
 *     written right after a colon, and "every route; though not every one needs listing." is the same hedge
 *     after a semicolon — a pin stopping at either would let both through (silent-failure-hunter, this PR).
 *  Whitespace is normalised first (`\s+` → one space, a blank line → a paragraph break), the same way the
 *  governance slicers flatten a section, so a re-wrap at another column changes nothing. A caller that has
 *  already flattened its text uses `pinNormalised` — `normalise` is not idempotent (see it).
 *
 * `opts.tail` is for a pin that deliberately stops mid-sentence: the exact remainder of the sentence, leading
 * space included, which must then follow the fragment verbatim and itself end at the boundary above.
 * `opts.label` names the pin in the error, the way `expect(x, label)` would.
 *
 * What it cannot see: an abbreviation ("e.g. this") reads as a sentence end, so a sentence carrying one is
 * pinned with `tail`; so does a stop inside a quote or a code span (`Reply "done." though only when asked`), since a
 * terminator may be followed by closers — pinned with `tail` the same way (#1807); an insertion *before* the fragment (member 3 of #771) is only caught when the fragment
 * starts before the gap; a change *inside* the fragment is a plain missing-fragment failure; and a new
 * sentence appended *after* the full stop is a new sentence, which is the governance PR's diff review to
 * judge, not this helper's.
 */
export type PinSentenceOptions = { label?: string; tail?: string };

/** A terminator and its optional markdown/quote closers, then whitespace or the end. `(?=\s|$)` keeps
 *  "claude.ai", "1.5" and "e.g.x" from reading as a boundary. */
const CLOSERS = '(?:\\*\\*|[)\\]"\'`])*';
const TERMINATOR = new RegExp(`[.!?]${CLOSERS}(?=\\s|$)`);
const ENDS_WITH_TERMINATOR = new RegExp(`[.!?]${CLOSERS}$`);
const CLOSERS_THEN_SPACE = new RegExp(`^${CLOSERS}(?:\\s|$)`);

/** Blank lines become `\n` (a paragraph break is a sentence boundary); every other run of whitespace one
 *  space. Not idempotent — a second pass reads the `\n` as a wrap — so it runs once per input: `pinSentence`
 *  applies it, `pinNormalised` expects it already applied. */
export const normalise = (text: string): string =>
  text.replace(/[^\S\n]*\n(?:[^\S\n]*\n)+/g, '\u0000').replace(/\s+/g, ' ').replace(/ ?\u0000 ?/g, '\n').trim();

/** The text from `rest`'s start to the end of the sentence it is in — the terminator itself excluded. */
const sentenceRest = (rest: string): string => {
  const para = rest.split('\n')[0];
  const m = TERMINATOR.exec(para);
  return m ? para.slice(0, m.index) : para;
};

/** On normalised inputs: the fragment occurs exactly once (or throws), and the text after it is returned. */
const after = (who: string, flatText: string, flatFragment: string): string => {
  if (!flatFragment) throw new Error(`${who}pinSentence was given an empty fragment — it would hold nothing`);
  const count = flatText.split(flatFragment).length - 1;
  if (count !== 1) {
    throw new Error(count === 0
      ? `${who}the pinned sentence is gone or reworded — "${flatFragment}" is not in the text`
      : `${who}"${flatFragment}" appears ${count} times, expected exactly once — a duplicate is a decoy, not a pin`);
  }
  return flatText.slice(flatText.indexOf(flatFragment) + flatFragment.length);
};

export function pinSentence(text: string, fragment: string, opts: PinSentenceOptions = {}): void {
  pinNormalised(normalise(text), normalise(fragment), opts);
}

/** The core, on inputs `normalise` has already flattened once — for a caller that mutates the flat text
 *  before pinning it (the #771 mutation proofs); everything else goes through `pinSentence`. */
export function pinNormalised(flatText: string, fragment: string, opts: PinSentenceOptions = {}): void {
  const who = opts.label ? `${opts.label}: ` : '';
  let flatFragment = fragment;
  let rest = after(who, flatText, flatFragment);
  if (opts.tail !== undefined) {
    // The tail is the exact continuation, leading space included — only its inner whitespace is normalised.
    const tail = opts.tail.replace(/\s+/g, ' ');
    if (!rest.startsWith(tail)) {
      throw new Error(`${who}the sentence does not continue "${flatFragment}" with the tail "${tail}" — `
        + `it continues "${sentenceRest(rest).trim()}"`);
    }
    flatFragment += tail;
    rest = after(who, flatText, flatFragment);
  }
  // A fragment that ends with its own terminator has closed its sentence: only closers and whitespace may follow it
  // (#1807). Falling back to "the rest of the sentence" there found the NEXT stop at index 0 and passed a doubled
  // terminator ("never.. though not every one.") with the hedge in between; the stray character is named with what follows.
  const closed = ENDS_WITH_TERMINATOR.test(flatFragment);
  if (closed && CLOSERS_THEN_SPACE.test(rest)) return;
  const trailing = closed ? rest.slice(0, 1) + sentenceRest(rest.slice(1)) : sentenceRest(rest);
  if (trailing.trim() !== '') {
    throw new Error(`${who}something follows "${flatFragment}" inside its own sentence: "${trailing.trim()}" — `
      + 'a hedge appended at the match boundary, or a pin that stops mid-sentence (give the exact remainder as `tail`)');
  }
}

/**
 * The ratchet's counter (#771, decision item 2): every **unanchored fragment pin** in a test file's source.
 *
 * Mechanically, a pin is a `.toMatch(…)` or `.toContain(…)` call whose argument is one regex, string or
 * `${}`-free template literal, directly closed by `)` (whitespace and newlines inside the parentheses are
 * allowed). It is **unanchored** when that literal does not end at a sentence boundary: a regex that does
 * not end in `$` or an escaped `\.`, `\!` or `\?` (a bare `.` is a wildcard and a bare `?`/`!` is syntax, so
 * `/foo./` and `/foo?/` are unanchored; `;` and `:` are not sentence ends — see `pinSentence`), each
 * optionally followed by escaped closers (`\*\*`, `\)`, `\]`, `"`, `'`, backtick); a string that does not
 * end in `.`, `!` or `?` plus those closers.
 *
 * Not counted, by design: a `.not.toMatch`/`.not.toContain` (a forbidden-phrasing check holds nothing in
 * place, so a boundary means nothing there); and a `pinSentence(` call, which is the anchored form. **Not
 * counted, and porous**: a non-literal argument — `toContain(agent)` in a loop, `toMatch(RULE)`,
 * `new RegExp(…)`, a `${}` template, a string built with `+` — which this cannot classify. So a pin written
 * one of those ways moves the number by nothing, and a literal pin *moved* into one of them lowers the
 * number by one without anchoring anything — the ratchet's "fell" message says so; the reviewer's diff read
 * is the guard there, as before this ratchet. A literal-only count is still the whole of the class #771
 * names, which was all literals.
 *
 * An abbreviation ending (`/costs e\.g\./`, `'e.g.'`) reads as anchored, as it does in `pinSentence`; an escaped dollar
 * (`/price in \$/`) and an escaped backslash before a wildcard (`/x\\./`) do not (#1807).
 *
 * Known limits, counted knowingly (PR #1805 review): a literal that is not a sentence at all — an identifier,
 * a label, a path, `'owner-session'`, `/labels=routine-ok/` — is counted when it lacks a terminator (64 of
 * the 372 today), so a new `toContain('some-id')` raises the count and is anchored by using `pinSentence` on
 * the sentence that names the id, or by a `toMatch(/some-id\b.*\./)` that runs to its sentence's end; and a
 * pin inside a comment (`// expect(s).toMatch(/x/)`) counts like a live one (none today). Neither is
 * narrowed here: skipping whitespace-free literals would also skip a one-word sentence fragment, and a
 * comment parser is more machinery than the number is worth.
 */
const PIN = /(\.not\s*)?\.(?:toMatch|toContain)\(\s*(?:\/((?:\\.|\[(?:\\.|[^\]\n])*\]|[^/\\\n])+)\/[a-z]*|'((?:\\.|[^'\\\n])*)'|"((?:\\.|[^"\\\n])*)"|`((?:\\.|(?!\$\{)[^`\\])*)`)\s*\)/g;
// An end anchor or an escaped stop — each only when the backslashes before it pair off: `\$` is a literal dollar and
// `\\.` an escaped backslash then the wildcard, so neither anchors anything (#1807). `e\.g\.` still reads as one (see below).
const ANCHORED_REGEX = /(?:(?<!\\)(?:\\\\)*\\[.!?]|(?<!\\)(?:\\\\)*\$)(?:\\\*\\\*|\\\)|\\\]|["'`])*$/;
const ANCHORED_STRING = /[.!?](?:\*\*|[)\]"'`])*$/;

export const unanchoredPins = (source: string): string[] => {
  const out: string[] = [];
  for (const m of source.matchAll(PIN)) {
    if (m[1]) continue;
    const [, , regex, single, double, template] = m;
    if (regex !== undefined) { if (!ANCHORED_REGEX.test(regex)) out.push(`/${regex}/`); continue; }
    const str = single ?? double ?? template ?? '';
    if (!ANCHORED_STRING.test(str)) out.push(JSON.stringify(str));
  }
  return out;
};

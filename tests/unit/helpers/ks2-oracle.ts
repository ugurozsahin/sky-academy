// An independent arithmetic oracle for KS2 cards (#1045). `solve()` in `curriculum.test.ts` only understands
// "two whole numbers and one operator" — every KS2 form (decimals, fractions, brackets, percentages, one-step
// letter equations) would ship with its arithmetic unchecked. This reads a prompt exactly, with no float ever
// touching a value: every number becomes an exact `Frac` (`../../src/curriculum/fractions`) — a decimal is a
// fraction with a power-of-ten denominator, so `0.1 + 0.2` is `1/10 + 2/10 = 3/10`, never `0.30000000000000004`.
//
// A prompt is read as a linear equation in at most one unknown (`?`, or a single lowercase letter such as
// `n`, optionally with a leading digit coefficient — `3n`): every token is folded into `{ coef, const }`
// (value = coef·x + const) as it is parsed, so `?`/`n` on either side, inside brackets, or under a nested
// `×`/`÷`, all fall out of the same fold. Two-unknown products (`n × n`) and division by an expression that
// still contains the unknown are not linear and are refused (`null`), not guessed.
//
// `N% of X` and `F of X` are not part of the +−×÷ grammar, so both are rewritten before tokenising: `N%`
// becomes the literal fraction `(N/100)` and the word `of` becomes `×` — "15% of 360" reads exactly like
// "(15/100) × 360". This is a textual rewrite, not a new code path.
import { type Frac, add, sub, mul, simplify, parseFrac, equal } from '../../../src/curriculum/fractions';
import { parseNum, type Dec } from '../../../src/curriculum/ks2num';

/** Independently evaluate simple arithmetic prompts like "7 + 5 = ?" / "? × 2 = 8" / "12 − ? = 5" — the
 * EYFS/KS1 fallback the generic per-topic loop in `curriculum.test.ts` already used before this oracle. */
export function solve(prompt: string): number | null {
  const m = prompt.replace(/−/g, '-').match(/^(\?|\d+)\s*([+\-×÷])\s*(\?|\d+)\s*=\s*(\?|\d+)$/);
  if (!m) return null;
  const [, a, op, b, c] = m;
  const f = (x: number, y: number) => op === '+' ? x + y : op === '-' ? x - y : op === '×' ? x * y : x / y;
  if (c === '?') return f(+a, +b);
  if (a === '?') return op === '+' ? +c - +b : op === '-' ? +c + +b : op === '×' ? +c / +b : +c * +b;
  if (b === '?') return op === '+' ? +c - +a : op === '-' ? +a - +c : op === '×' ? +c / +a : +a / +c;
  return null;
}

const ZERO: Frac = { n: 0, d: 1 };
const isZero = (f: Frac) => f.n === 0;
/** `simplify`s the flipped fraction, since a raw `{ n: f.d, d: f.n }` can carry `f.n`'s sign on `d` instead
 * of `n` — a call site that took it at face value rather than re-normalising through `mul`/`sub` first would
 * violate `Frac`'s own invariant (#1423 review). Callers guard `f` non-zero first; `f.n` is never 0 here. */
const reciprocal = (f: Frac): Frac => simplify({ n: f.d, d: f.n });

/** A value that may still depend on the one unknown: `coef * x + const`. A plain number is `coef = 0`. */
interface Lin { readonly coef: Frac; readonly const: Frac }
const known = (f: Frac): Lin => ({ coef: ZERO, const: f });
const UNKNOWN: Lin = { coef: { n: 1, d: 1 }, const: ZERO };

function addLin(a: Lin, b: Lin): Lin { return { coef: add(a.coef, b.coef), const: add(a.const, b.const) }; }
function subLin(a: Lin, b: Lin): Lin { return { coef: sub(a.coef, b.coef), const: sub(a.const, b.const) }; }
/** `x * x` is not linear and is refused; multiplying by a plain number scales both `coef` and `const`. */
function mulLin(a: Lin, b: Lin): Lin | null {
  if (isZero(a.coef)) return { coef: mul(b.coef, a.const), const: mul(b.const, a.const) };
  if (isZero(b.coef)) return { coef: mul(a.coef, b.const), const: mul(a.const, b.const) };
  return null;
}
/** Dividing by an expression that still carries the unknown is not linear and is refused, as is `÷ 0`. */
function divLin(a: Lin, b: Lin): Lin | null {
  if (!isZero(b.coef) || isZero(b.const)) return null;
  const r = reciprocal(b.const);
  return { coef: mul(a.coef, r), const: mul(a.const, r) };
}

type Tok =
  | { k: 'num'; v: Frac }
  | { k: 'unk'; letter?: string }
  | { k: 'op'; v: '+' | '-' | '×' | '÷' }
  | { k: 'lparen' }
  | { k: 'rparen' };

const MIXED_RE = /^(\d+)\s+(\d+)\/(\d+)/;
const FRAC_RE = /^(\d+)\/(\d+)/;
const NUM_CHUNK_RE = /^[\d,]*\d(?:\.\d+)?/;

function decToFrac(d: Dec): Frac { return simplify({ n: d.v, d: 10 ** d.dp }); }

/** Reads one number literal at the front of `s`: a mixed number, a plain fraction, or a comma/decimal number
 * (validated by `ks2num`'s own strict grouping, so "12,3,456" is rejected here, not silently truncated). */
function readNumber(s: string): { v: Frac; len: number } | null {
  let m = MIXED_RE.exec(s);
  if (m) {
    const [, whole, n, d] = m;
    const dd = Number(d);
    if (dd === 0) return null;
    return { v: simplify({ n: Number(whole) * dd + Number(n), d: dd }), len: m[0].length };
  }
  m = FRAC_RE.exec(s);
  if (m) {
    const [, n, d] = m;
    const dd = Number(d);
    if (dd === 0) return null;
    return { v: simplify({ n: Number(n), d: dd }), len: m[0].length };
  }
  m = NUM_CHUNK_RE.exec(s);
  if (m) {
    const dec = parseNum(m[0]);
    if (!dec) return null;
    return { v: decToFrac(dec), len: m[0].length };
  }
  return null;
}

/** Every character that stands for exactly one fixed token, `-`/`−` and `×`/`*` and `÷`/`/` folded onto the
 * one operator each pair means. Digits, letters and spaces are read separately below — none is fixed-width. */
const SIMPLE_TOKENS: Record<string, Tok> = {
  '(': { k: 'lparen' }, ')': { k: 'rparen' },
  '+': { k: 'op', v: '+' }, '-': { k: 'op', v: '-' }, '−': { k: 'op', v: '-' },
  '×': { k: 'op', v: '×' }, '*': { k: 'op', v: '×' }, '÷': { k: 'op', v: '÷' }, '/': { k: 'op', v: '÷' },
};
const isLower = (c: string) => c >= 'a' && c <= 'z';
const isDigit = (c: string) => c >= '0' && c <= '9';

/** Reads one number literal at `i` (`readNumber`) plus, when a letter follows with no space (`3n`), the
 * implicit `×` between them. `null` when `i` is not a number this grammar reads at all. */
function readNumberTokens(s: string, i: number): { toks: Tok[]; next: number } | null {
  const read = readNumber(s.slice(i));
  if (!read) return null;
  const next = i + read.len;
  const toks: Tok[] = [{ k: 'num', v: read.v }];
  if (next < s.length && isLower(s[next])) toks.push({ k: 'op', v: '×' });
  return { toks, next };
}

/** Shared across both sides of one equation (`ks2Solve` passes the same object to both `tokenize` calls),
 * so `letterOf` can refuse a second, different unknown symbol wherever in the prompt it turns up — "at most
 * one unknown" is a claim about the whole equation, not about either side read on its own, and `?` and a
 * letter are two different symbols even though both parse as `UNKNOWN` (#1423 review: `'? + n = 10'`). `'?'`
 * itself stands in for "the `?` symbol was the unknown seen so far", never a real variable name. */
interface LetterState { letter: string | null }

/** Tokenises a linear expression: `+ - − × ÷ ( )`, number literals, and `?`/a single lowercase letter as the
 * one unknown. A digit run immediately followed by a letter (`3n`) is an implicit `×`. `null` on anything
 * this grammar does not cover (a word, an unsupported symbol, a malformed number, a second distinct letter). */
function tokenize(s: string, letterOf: LetterState): Tok[] | null {
  const toks: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ') { i++; continue; }
    if (c in SIMPLE_TOKENS) { toks.push(SIMPLE_TOKENS[c]); i++; continue; }
    if (c === '?') {
      if (letterOf.letter !== null && letterOf.letter !== '?') return null;   // e.g. "? + n" — two symbols
      letterOf.letter = '?';
      toks.push({ k: 'unk' });
      i++;
      continue;
    }
    if (isDigit(c)) {
      const read = readNumberTokens(s, i);
      if (!read) return null;
      toks.push(...read.toks);
      i = read.next;
      continue;
    }
    if (isLower(c)) {
      if (letterOf.letter !== null && letterOf.letter !== c) return null;   // a second, different letter
      letterOf.letter = c;
      toks.push({ k: 'unk', letter: c });
      i++;
      continue;
    }
    return null;
  }
  return toks;
}

/** A cursor into a token array, threaded through the recursive-descent parser below. */
interface Cur { i: number }

function parseFactor(t: Tok[], c: Cur): Lin | null {
  const tok = t[c.i];
  if (!tok) return null;
  if (tok.k === 'op' && tok.v === '-') { c.i++; const f = parseFactor(t, c); return f && subLin(known(ZERO), f); }
  if (tok.k === 'num') { c.i++; return known(tok.v); }
  if (tok.k === 'unk') { c.i++; return UNKNOWN; }
  if (tok.k === 'lparen') {
    c.i++;
    const inner = parseExpr(t, c);
    if (!inner || t[c.i]?.k !== 'rparen') return null;
    c.i++;
    return inner;
  }
  return null;
}

function parseTerm(t: Tok[], c: Cur): Lin | null {
  const first = parseFactor(t, c);
  if (!first) return null;
  let left: Lin = first;
  for (;;) {
    const tok = t[c.i];
    if (tok?.k === 'op' && (tok.v === '×' || tok.v === '÷')) {
      c.i++;
      const right = parseFactor(t, c);
      if (!right) return null;
      const combined: Lin | null = tok.v === '×' ? mulLin(left, right) : divLin(left, right);
      if (!combined) return null;
      left = combined;
    } else return left;
  }
}

function parseExpr(t: Tok[], c: Cur): Lin | null {
  const first = parseTerm(t, c);
  if (!first) return null;
  let left: Lin = first;
  for (;;) {
    const tok = t[c.i];
    if (tok?.k === 'op' && (tok.v === '+' || tok.v === '-')) {
      c.i++;
      const right = parseTerm(t, c);
      if (!right) return null;
      left = tok.v === '+' ? addLin(left, right) : subLin(left, right);
    } else return left;
  }
}

/** `s` read whole as one linear expression (brackets and precedence honoured), or `null` if any of it is
 * left over — a partial parse is not a reading of the prompt. */
function readSide(s: string, letterOf: LetterState): Lin | null {
  const toks = tokenize(s.trim(), letterOf);
  if (!toks || toks.length === 0) return null;
  const c: Cur = { i: 0 };
  const lin = parseExpr(toks, c);
  return lin && c.i === toks.length ? lin : null;
}

/**
 * Reads a KS2 arithmetic prompt as an equation in at most one unknown (`?`, or a coefficented lowercase
 * letter) and returns its exact value, or `null` for anything outside that grammar (a word problem, a
 * rounding instruction, an unrecognised symbol, a non-linear equation, `÷ 0`, a malformed comma group).
 * Never throws: every parsing step returns `null` rather than raising on bad input.
 */
export function ks2Solve(prompt: string): Frac | null {
  // "N% of X" → "(N/100) × X"; "F of X" → "F × X" — same +−×÷ grammar either way. Rewritten before the
  // `=` split: the substitution changes the string's length, so the split must run on its result.
  const rewritten = prompt.replace(/(\d+)%/g, '($1/100)').replace(/\bof\b/g, '×');
  const eq = rewritten.indexOf('=');
  if (eq === -1) return null;
  const letterOf: LetterState = { letter: null };
  const lhs = readSide(rewritten.slice(0, eq), letterOf);
  const rhs = readSide(rewritten.slice(eq + 1), letterOf);
  if (!lhs || !rhs) return null;
  const coefDiff = sub(lhs.coef, rhs.coef);
  if (isZero(coefDiff)) return null;   // no unknown at all (not this oracle's job), or it cancelled out
  return mul(sub(rhs.const, lhs.const), reciprocal(coefDiff));
}

/** `answer` (a decimal, a comma-grouped whole number, a plain or mixed fraction, signed with U+2212 or a
 * hyphen) read as one exact value and compared to `value` by cross-multiplication — so "0.5", "1/2" and
 * "2/4" all agree. `false` for an answer this cannot read at all. */
export function sameValue(answer: string, value: Frac): boolean {
  const trimmed = answer.trim();
  const f = parseFrac(trimmed) ?? (() => { const d = parseNum(trimmed); return d ? decToFrac(d) : null; })();
  return f !== null && equal(f, value);
}

/** The generic per-topic loop's one arithmetic check for a card (#1045): a KS2 topic tries the exact
 * `ks2Solve` oracle first; an EYFS/KS1 topic, or a KS2 card `ks2Solve` does not recognise, falls back to
 * `solve`'s bare-number check. `null` when neither has an opinion on `prompt` at all (nothing to assert). */
export function arithmeticCheck(isKs2Year: boolean, prompt: string, answer: string): boolean | null {
  const value = isKs2Year ? ks2Solve(prompt) : null;
  if (value !== null) return sameValue(answer, value);
  const s = solve(prompt);
  return s === null ? null : Number(answer) === s;
}

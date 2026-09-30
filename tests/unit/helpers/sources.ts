import { readdirSync, readFileSync } from 'node:fs';
import ts from 'typescript';

/**
 * The readers the rail files share (#321). They live here so the split files cannot drift into several
 * slightly different ideas of what "the source" is — and so that a helper going blind is one red rail rather
 * than a whole group quietly passing. `tests/unit/helpers.test.ts` holds that.
 *
 * Every reader here **fails loudly rather than returning nothing**. That is the whole point: a rail suite's
 * characteristic failure is the vacuous pass, and a reader that answers "no files" to a question about files
 * turns every rail downstream of it green at once. `readFileSync` already throws; `inDir` and `workflowFiles`
 * are made to (PR #417 review, note 3).
 */
export const SOURCES = import.meta.glob('/src/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** Every `src/storage/*.ts` part joined in path order, for the rails that read storage as one text (#1415). Throws
 *  on none: a moved folder must not turn every storage rail vacuous. */
export const STORAGE_SRC = ((): string => {
  const parts = Object.keys(SOURCES).filter((p) => p.startsWith('/src/storage/')).sort();
  if (parts.length === 0) throw new Error('no src/storage/*.ts modules found — every storage rail would pass vacuously');
  return parts.map((p) => SOURCES[p]).join('\n');
})();

const WORKFLOWS = new URL('../../../.github/workflows/', import.meta.url);

// Vite's glob does not reach `.github/`, so these are read from disk. `readFileSync` throwing on a path that
// moved is the non-vacuity guarantee for the named-file form.
export const workflow = (name: 'ci.yml' | 'review-gate.yml' | 'android.yml') =>
  readFileSync(new URL(name, WORKFLOWS), 'utf8');

/** Every workflow file, for the rails that must hold across all of them rather than one by name. `dir` is
 *  the directory to read, real workflows by default — a test points it at a fixture directory with no
 *  `.yml`/`.yaml` files to prove the vacuity guard actually fires, rather than only reading it in prose (#680). */
export const workflowFiles = (dir: URL = WORKFLOWS): { name: string; text: string }[] => {
  const names = readdirSync(dir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
  if (names.length === 0) throw new Error('no workflow files found — every workflow rail would pass vacuously');
  return names.map((name) => ({ name, text: readFileSync(new URL(name, dir), 'utf8') }));
};

const SRC = new URL('../../../src/', import.meta.url);

/** `src/style.css` is an entry point of `@import` lines into `src/styles/*.css` (#558) — this reads the
 *  entry and every file it imports, concatenated in import order, so a rail asking what the stylesheet
 *  says sees the same text Vite bundles rather than one split-out file. `root` is the directory holding
 *  `style.css`, real `src/` by default — a test points it at a fixture with no `@import` lines, a
 *  duplicated one, or an orphaned file, to prove each guard below actually fires, the same shape
 *  `workflowFiles`/`e2eSpecFiles` use for theirs.
 *
 *  Two failures a bare `@import`-graph walk would miss silently (`pr-test-analyzer`/`silent-failure-hunter`
 *  review, #558): the same file imported twice, which would double that section's rules in what this
 *  returns without ever showing up as "the stylesheet read empty"; and a file added under `src/styles/`
 *  that nothing imports, which Vite would never bundle either — so a rail asking "is the whole stylesheet
 *  here" must not silently pass on less than the real `src/styles/` directory. Both are guarded here rather
 *  than left to be caught (or not) by whatever floor a caller happens to assert on the result. */
export const styleCss = (root: URL = SRC): string => {
  const entry = readFileSync(new URL('style.css', root), 'utf8');
  const imports = [...entry.matchAll(/@import\s+['"](\.\/[^'"]+)['"];/g)].map((m) => m[1]);
  if (imports.length === 0) throw new Error('src/style.css has no @import lines — check it still splits into src/styles/*.css');
  const seen = new Set<string>();
  for (const rel of imports) {
    if (seen.has(rel)) throw new Error(`src/style.css imports ${rel} more than once — Vite would bundle its rules twice`);
    seen.add(rel);
  }
  const named = new Set(imports.map((rel) => rel.split('/').pop()));
  const onDisk = readdirSync(new URL('styles/', root)).filter((f) => f.endsWith('.css'));
  const orphaned = onDisk.filter((f) => !named.has(f));
  if (orphaned.length > 0)
    throw new Error(`src/styles/ holds file(s) no @import in src/style.css names, so Vite never bundles them: ${orphaned.join(', ')}`);
  return imports.map((rel) => readFileSync(new URL(rel, root), 'utf8')).join('');
};

const E2E = new URL('../../../tests/e2e/', import.meta.url);

/** Every `tests/e2e/*.spec.ts` file, for a rail that must hold across all of them (#750). Same vacuity guard
 *  as `workflowFiles` above — `dir` is the directory to read, real e2e specs by default, a test points it at
 *  a fixture directory with no `.spec.ts` files to prove the vacuity guard actually fires (#794). `tests/sketch/`
 *  is a different `testDir` (its own `sketchbook` project) and deliberately not read here. */
export const e2eSpecFiles = (dir: URL = E2E): { name: string; text: string }[] => {
  const names = readdirSync(dir).filter((f) => f.endsWith('.spec.ts'));
  if (names.length === 0) throw new Error('no tests/e2e/*.spec.ts files found — the @smoke rail would pass vacuously');
  return names.map((name) => ({ name, text: readFileSync(new URL(name, dir), 'utf8') }));
};

/** The `src/` modules under `dir`. Throws rather than returning `[]`: a directory spelled wrongly — a leading
 *  slash dropped, a folder renamed — is the shape that makes a rail green for ever. */
export const inDir = (dir: string): [string, string][] => {
  const found = Object.entries(SOURCES).filter(([f]) => f.startsWith(dir));
  if (found.length === 0) throw new Error(`no src/ modules under "${dir}" — check the path, including the leading slash`);
  return found;
};

// Comments may name the very thing a rail bans, so rails strip them first. A hand-rolled character scan
// (this file's history: #775, #780, #816, an earlier draft of #827) kept re-discovering the same problem in a
// new shape: a comment-shaped substring sitting inside a real string, regex or template literal is not a
// real comment, and telling the two apart from raw characters means knowing whether each `/`, `'`, `"` or
// `` ` `` opens one of those or sits inside one already open. That is the language's own grammar, not
// something a hand-rolled heuristic gets right on every input — #775/#780 were regressions from trying to
// spot a regex literal by its preceding character, and #827's first fix attempt (giving this file its own
// string-literal tracking, by the same means) broke a real file the moment a regex literal containing a
// quote character — `src/ui/dom.ts`'s `esc()`, `src/ui/font.ts`'s `familyOf()`, both real, both today — desynced
// it: the same class of defect, reopened by a different door.
//
// So this reads the source with the real TypeScript parser instead of re-deriving its grammar by hand. The
// parser has already, correctly, decided where every string, template literal, regex literal and comment
// starts and ends — that is what parsing a language *is* — so this only ever asks it, never re-solves it.
// `tests/unit/guardrails.test.ts`'s `importSpecifiers()` already pays for the `typescript` dependency this
// reader now shares.
//
// A real comment is usually never a node at all — it is trivia, sitting in the gap between two tokens —
// except a `/** ... */` doc comment immediately before a declaration, which the parser attaches as a `JSDoc`
// node of its own (found reviewing an early version of this fix against a fixture with exactly that shape).
// So this walks the token tree collecting every leaf's span, and treats any node whose own text begins with
// `//` or `/*` as one comment rather than recursing into it, instead of assuming only trivia can be a
// comment — a node's text can begin that way only because the parser decided the whole thing is a comment,
// since no real token or expression can. Between the spans found this way — the trivia the parser skipped —
// the #816 throw-on-unterminated-`/*` guard still applies: those gaps can never hold a string, regex or
// template literal (the parser would have made a token of it instead), so a plain left-to-right scan for
// `//`/`/*...*/` is safe there, with no notion of escaping needed at all.
const isCommentAt = (src: string, at: number) => src.startsWith('//', at) || src.startsWith('/*', at);

// A `/*` with no closing `*/` before the end of a trivia gap throws rather than silently swallowing everything
// after it to a single space (#816) — no real src/*.ts file can contain one (tsc rejects it), but a
// hand-written test fixture that is not valid TypeScript could, and this reader is applied to those too.
const stripTrivia = (src: string, from: number, to: number): string => {
  let out = '';
  let i = from;
  while (i < to) {
    if (src[i] === '/' && src[i + 1] === '/') {
      while (i < to && src[i] !== '\n') i++;
      out += ' ';
      continue;
    }
    if (src[i] === '/' && src[i + 1] === '*') {
      const close = src.indexOf('*/', i + 2);
      if (close === -1 || close >= to) throw new Error('unterminated /* comment — check for a missing closing */');
      i = close + 2;
      out += ' ';
      continue;
    }
    out += src[i];
    i++;
  }
  return out;
};

type Span = { start: number; end: number; comment: boolean };

// Collects every leaf token's span, plus every comment-shaped node's span in place of its own children, left
// to right and never overlapping — what is left between consecutive spans is exactly the trivia
// `stripTrivia` above is safe to scan.
const collectSpans = (node: ts.Node, sourceFile: ts.SourceFile, src: string, into: Span[]): void => {
  const start = node.getStart(sourceFile);
  const end = node.getEnd();
  if (isCommentAt(src, start)) {
    into.push({ start, end, comment: true });
    return;
  }
  const children = node.getChildren(sourceFile);
  if (children.length === 0) {
    into.push({ start, end, comment: false });
    return;
  }
  for (const child of children) collectSpans(child, sourceFile, src, into);
};

// Assembles the final string from the spans `collectSpans` found, left to right. Split out from `code()`
// so the ordering invariant it depends on — spans arrive non-overlapping and never run backwards, which
// `collectSpans`'s own left-to-right traversal already guarantees — can be pinned with a synthetic span
// list (#844, type-design-analyzer): the real parser cannot be driven to produce an out-of-order span, so
// this is reachable only if a future edit to `collectSpans` breaks that guarantee, and a broken guarantee
// must corrupt loudly (`stripTrivia(src, from, to)` with `from > to` would otherwise silently return `''`,
// dropping or re-emitting source text with no error) rather than the way #816 already treats an unterminated
// comment. Exported for that one test; no other caller needs it — `spans` must already be left-to-right
// and non-overlapping (`collectSpans`'s own contract), and the guard below is what enforces that on a
// caller's behalf rather than trusting it silently.
//
// Two different-shaped violations, both checked (silent-failure-hunter review of this diff, #844): a span
// starting before the previous one ended (`span.start < pos`) is the one the comment above already argues
// for, but a span whose own `end` is before its own `start` slips past that check untouched — `pos` is not
// yet corrupted when this span is reached, so `span.start < pos` can still be false, and `src.slice(start,
// end)` with `end < start` then silently returns `''` while `pos` is set *backwards*, so the *next* span's
// `stripTrivia(pos, next.start)` re-reads and duplicates a stretch of source already emitted — the same
// silent corruption this guard exists to rule out, reached by a different malformed span.
export const assemble = (src: string, spans: Span[]): string => {
  let out = '';
  let pos = 0;
  for (const span of spans) {
    if (span.start < pos || span.end < span.start)
      throw new Error(`code(): span [${span.start}, ${span.end}) is out of order after the previous span ended at ${pos} — collectSpans must be broken`);
    out += stripTrivia(src, pos, span.start);
    out += span.comment ? ' ' : src.slice(span.start, span.end);
    pos = span.end;
  }
  out += stripTrivia(src, pos, src.length);
  return out;
};

export const code = (src: string): string => {
  const sourceFile = ts.createSourceFile('code.ts', src, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
  const spans: Span[] = [];
  collectSpans(sourceFile, sourceFile, src, spans);
  return assemble(src, spans);
};

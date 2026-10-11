import { posix } from 'node:path';
import ts from 'typescript';

/**
 * The import-edge reader the `src/three/` boundary rails in `guardrails.test.ts` walk every source file with
 * (#714). It lived inside that file's describe block until #841: the file is frozen at its length
 * (`lint-ratchet.json`, #1388), so a regression test for the reader could no longer be added beside it. Here it
 * is importable by `guardrails-edges.test.ts` as well.
 */
export interface Edge { from: string; spec: string; to: string; kind: 'static' | 'type' | 'dynamic' | 'require' }

/** A node that may carry a specifier, already unwrapped, and the kind of edge it would be. `specText()` decides
 *  whether it carries one at all. */
type Hit = [spec: ts.Node | undefined, kind: Edge['kind']];

// A template literal with a substitution (`` `../objects/${name}.ts` ``) can't be resolved exactly, but a
// per-name dynamic loader written that way is a realistic pattern in exactly the area this rail polices
// (review finding #1 on PR #799) — dropping it silently would un-police it entirely. Its static pieces
// still say enough to trip a boundary check, so each substitution is replaced with a placeholder rather
// than the edge vanishing: `` `../three/${x}` `` becomes `../three/${…}`, which still resolves to
// somewhere under `/src/three/`.
const specText = (n: ts.Node | undefined): string | null => {
  if (!n) return null;
  if (ts.isStringLiteralLike(n)) return n.text;
  if (ts.isTemplateExpression(n)) return n.head.text + n.templateSpans.map((s) => '${…}' + s.literal.text).join('');
  return null;
};
// `ts.isImportCall` isn't in this TypeScript version's public .d.ts, so this stands in for it — matching the
// internal function exactly (checked against installed typescript@5.9.3), including `import.defer('x')`
// (the deferred-module-evaluation call form), not just plain `import('x')` (type-design-analyzer review).
const isDynamicImportTarget = (e: ts.Expression): boolean =>
  e.kind === ts.SyntaxKind.ImportKeyword ||
  (ts.isMetaProperty(e) && e.keywordToken === ts.SyntaxKind.ImportKeyword && e.name.text === 'defer');
// #803 (PR #799 review): `(require)('x')` and `(0, require)('x')` are real minifier/bundler output shapes —
// unwrap a parenthesized callee, and a comma-expression's right-hand side, before testing its shape.
const unwrapRequireCallee = (e: ts.Expression): ts.Expression => {
  while (ts.isParenthesizedExpression(e)) e = e.expression;
  if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.CommaToken) return unwrapRequireCallee(e.right);
  return e;
};
const isRequireCallee = (e: ts.Expression): boolean => {
  const u = unwrapRequireCallee(e);
  return (ts.isIdentifier(u) && u.text === 'require') || (ts.isPropertyAccessExpression(u) && u.name.text === 'require');
};
// #803/#820 unwrap a parenthesized *callee* and a parenthesized *array argument* to import.meta.glob; #829
// widens this to the dynamic-import and require branches' own call argument — `import(('x'))`/`require(('x'))`
// are both valid, compiling shapes (a bundler/minifier can add or preserve stray parens around either), and
// specText() has no ParenthesizedExpression case, so an unwrapped argument silently produced no edge at all.
const unwrapParens = (e: ts.Expression): ts.Expression => ts.isParenthesizedExpression(e) ? unwrapParens(e.expression) : e;
const arg0 = (call: ts.CallExpression): ts.Expression | undefined => {
  const a = call.arguments[0];
  return a ? unwrapParens(a) : undefined;
};
// #803 (PR #799 review): `import { type A } from 'x'` has no whole-clause `isTypeOnly`, but when every named
// binding is individually `type`-qualified nothing ships either way — the same "erased before emit" test the
// clause-level flag already applies. A default binding (`import Foo, { type A } from 'x'`) is a value import
// regardless, so it never qualifies.
const namedBindingsAllTypeOnly = (clause: ts.ImportClause | undefined): boolean => {
  if (!clause || clause.isTypeOnly || clause.name) return false;
  const bindings = clause.namedBindings;
  return !!bindings && ts.isNamedImports(bindings) && bindings.elements.length > 0 &&
    bindings.elements.every((el) => el.isTypeOnly);
};
// #820: the export-side twin of namedBindingsAllTypeOnly above — `export { type A } from 'x'` has no
// whole-clause `isTypeOnly` either, and was still being read at clause granularity after #803 taught the
// import side this same lesson.
const namedExportsAllTypeOnly = (clause: ts.NamedExportBindings | undefined): boolean =>
  !!clause && ts.isNamedExports(clause) && clause.elements.length > 0 && clause.elements.every((el) => el.isTypeOnly);

// One reader per import shape, tried in order; the first that recognises the node answers for it (the same
// first-match-wins the one `else if` chain had before #841 split it to keep each piece under the complexity
// limit). `null` means "not my shape", an empty hit means "my shape, but nothing readable".
const importOrExport = (node: ts.Node): Hit[] | null => {
  if (!(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) || !node.moduleSpecifier) return null;
  const typeOnly = ts.isImportDeclaration(node)
    ? !!node.importClause?.isTypeOnly || namedBindingsAllTypeOnly(node.importClause)
    : !!node.isTypeOnly || namedExportsAllTypeOnly(node.exportClause);
  return [[node.moduleSpecifier, typeOnly ? 'type' : 'static']];
};
// `typeof import('x')` and a bare `import('x')` type reference both land here; either way nothing ships.
const importType = (node: ts.Node): Hit[] | null =>
  ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) ? [[node.argument.literal, 'type']] : null;
const dynamicImport = (node: ts.Node): Hit[] | null =>
  ts.isCallExpression(node) && isDynamicImportTarget(node.expression) ? [[arg0(node), 'dynamic']] : null;
// Bare `require('x')` and `obj.require('x')` alike — the old regex matched the literal substring
// `require(` wherever it sat, so an AST-based reader that only recognised a bare identifier callee
// would silently drop `obj.require('x')` that the old code caught (silent-failure-hunter review).
const requireCall = (node: ts.Node): Hit[] | null =>
  ts.isCallExpression(node) && isRequireCallee(node.expression) ? [[arg0(node), 'require']] : null;
// `import x = require('x')` never parses as a CallExpression at all — its whole
// `require('x')` is its own ExternalModuleReference node, holding the string literal directly
// (silent-failure-hunter review; unreachable on this ESM-only project's real `src/` today since
// `tsconfig.json`'s `module: ESNext` and the absent `@types/node` both already fail it, but the old
// regex matched it by text and the walker should not need that gate to also be correct).
// #837: unwrap a parenthesized argument here too, for the same reason #829 does it on the other two
// branches — `import x = require(('x'))` is a real, parseable AST shape (a ParenthesizedExpression
// wrapping the string literal), even though it too fails this project's own `tsc --noEmit` gate.
const externalModuleReference = (node: ts.Node): Hit[] | null =>
  ts.isExternalModuleReference(node) ? [[unwrapParens(node.expression), 'require']] : null;
// `import.meta.glob('../three/stage/*.ts')` is an import Vite resolves and bundles too (pr-test-analyzer).
// #803: the array-pattern form (`import.meta.glob([...])`, ordinary Vite usage) is walked element by
// element rather than dropped whole — a single non-array argument keeps the old single-edge behaviour.
// #820: `import.meta.glob((['...']))` — the array wrapped in its own parentheses — used to fall through
// to the non-array branch, silently dropping every element inside; unwrap parens first, mirroring
// `unwrapRequireCallee`'s own paren-unwrapping above. Review of PR #825: unwrap each element too, not just
// the top-level argument — a paren-wrapped element inside the array previously fell through specText's
// ParenthesizedExpression blind spot and silently dropped its edge, the unsafe direction for this rail (a
// real value import could hide).
const isMetaGlobCall = (node: ts.Node): node is ts.CallExpression =>
  ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
  node.expression.name.text === 'glob' && ts.isMetaProperty(node.expression.expression) &&
  node.expression.expression.keywordToken === ts.SyntaxKind.ImportKeyword;
const metaGlob = (node: ts.Node): Hit[] | null => {
  if (!isMetaGlobCall(node)) return null;
  const arg = arg0(node);
  return arg && ts.isArrayLiteralExpression(arg) ? arg.elements.map((el) => [unwrapParens(el), 'static']) : [[arg, 'static']];
};
const READERS = [importOrExport, importType, dynamicImport, requireCall, externalModuleReference, metaGlob];

/** Every literal import edge out of `path`, read from the TypeScript AST rather than a hand-written regex plus
 *  a hand-written decode() (#736). A parsed string literal's `.text` is already what tsc/Vite themselves
 *  decode it to -- a unicode escape, a hex escape, a backslash line-continuation, a bare carriage-return line
 *  terminator -- so there is no decode step of our own left to drift from theirs (PR #710's rounds 3-6 were
 *  each a spelling the old decode() had not yet been taught, one round at a time). Parsing straight from `src`
 *  also means a `/*`/`//` inside a string literal can never be mistaken for a comment the way `code()`'s
 *  textual stripping can (#736's round-7 finding; `code()` itself is #780's separate, still-open scope for its
 *  other call sites). A plain `import('x')` used as a *type* (with or without `typeof`) is always `kind:
 *  'type'` here -- nothing ships either way, so `import type { B } from './x'`, `type T = typeof
 *  import('./x')` and `let v: import('./x').T` all count the same, which the old regex's `typeof`-only check
 *  did not. */
export const edges = (path: string, src: string): Edge[] => {
  const out: Edge[] = [];
  const to = (spec: string) => spec.startsWith('.') ? posix.resolve(posix.dirname(path), spec) : spec;
  const push = (spec: string, kind: Edge['kind']) => out.push({ from: path, spec, to: to(spec), kind });
  const visit = (node: ts.Node): void => {
    const hits = READERS.reduce<Hit[] | null>((found, read) => found ?? read(node), null) ?? [];
    for (const [spec, kind] of hits) {
      const text = specText(spec);
      if (text !== null) push(text, kind);
    }
    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile(path, src, ts.ScriptTarget.Latest, true));
  return out;
};

import { describe, expect, it } from 'vitest';
import { edges } from './helpers/edges';

// #841: the last two branches of edges() that still read a module specifier straight into specText() with no
// paren-unwrapping, after #803/#820/#829/#837 fixed the other four one at a time. specText() has no
// ParenthesizedExpression case, so a paren-wrapped specifier produced no edge at all — the unsafe direction
// for a boundary rail. Each form below parses with zero diagnostics on the bare TypeScript parser edges()
// itself uses (typescript@5.9.3; checked with ts.createSourceFile in this fix), even though every one fails
// this project's own `tsc --noEmit` on the semantic TS1141 "String literal expected" — the same reasoning
// #829 and #837 already apply: the walker should not need that gate to also be correct. These tests live
// here rather than beside the #837 ones because guardrails.test.ts is frozen at its length (#1388).
describe('edges() unwraps a paren-wrapped module specifier in every branch (#841)', () => {
  const rig = (kind: 'static' | 'type') =>
    [{ from: '/src/ui/x.ts', spec: '../three/stage/rig', to: '/src/three/stage/rig', kind }];

  // Branch 1: the main ImportDeclaration/ExportDeclaration branch, whose moduleSpecifier parses as a
  // ParenthesizedExpression wrapping the string literal. Proved red on the reader before the unwrap.
  it.each([
    ['import x from (\'y\')', "import rig from ('../three/stage/rig');", 'static'],
    ['import * as x from ((\'y\')) — two extra layers', "import * as rig from (('../three/stage/rig'));", 'static'],
    ['export { c } from (\'y\')', "export { c } from ('../three/stage/rig');", 'static'],
    ['import type { T } from (\'y\') — still type-only once unwrapped', "import type { T } from ('../three/stage/rig');", 'type'],
  ] as const)('%s still produces its edge, not silently nothing (#841)', (_case, src, kind) => {
    expect(edges('/src/ui/x.ts', src)).toEqual(rig(kind));
  });

  // Branch 2: the ImportTypeNode branch, gated on ts.isLiteralTypeNode(node.argument) — a paren-wrapped
  // argument parses as a ParenthesizedType wrapping the LiteralType, so the gate was false and the whole
  // branch never fired. unwrapParens() only unwraps a ts.Expression, so this needs the type-node twin.
  it.each([
    ['typeof import((\'x\'))', "type T = typeof import(('../three/stage/rig')); export const a = 1;"],
    ['typeof import(((\'x\'))) — two extra layers', "type T = typeof import((('../three/stage/rig'))); export const a = 1;"],
    ['a bare import((\'x\')).T type reference', "let v: import(('../three/stage/rig')).Rig; export const a = v;"],
  ])('%s still produces its type edge, not silently nothing (#841)', (_case, src) => {
    expect(edges('/src/ui/x.ts', src)).toEqual(rig('type'));
  });

  // Control: the unwrapped forms read exactly as before, so the unwrap changed nothing on the common path.
  it('the plain forms still produce the same edges (#841 control)', () => {
    expect(edges('/src/ui/x.ts', "import rig from '../three/stage/rig';")).toEqual(rig('static'));
    expect(edges('/src/ui/x.ts', "type T = typeof import('../three/stage/rig'); export const a = 1;")).toEqual(rig('type'));
  });
});

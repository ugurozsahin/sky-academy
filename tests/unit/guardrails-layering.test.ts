import { posix } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { inDir } from './helpers/sources';

/**
 * The layers of `src/` (#1413, #325): `src/curriculum/` is data, `src/game/` is logic, `src/ui/` is the views.
 * The dependency runs one way, curriculum <- game <- ui, and a folder split must not turn it round: it is why
 * `src/game/session.ts` runs without a browser and why the sim harness works at all.
 */
const LAYERS = ['curriculum', 'game', 'ui'] as const;

/** Every module specifier a file imports, re-exports or `import()`s, resolved to a `/src/...` path. */
const importsOf = (file: string, source: string): string[] => {
  const out: string[] = [];
  const add = (spec: string) => { if (spec.startsWith('.')) out.push(posix.join(posix.dirname(file), spec)); };
  const visit = (n: ts.Node): void => {
    if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) add(n.moduleSpecifier.text);
    if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteralLike(n.arguments[0])) add(n.arguments[0].text);
    ts.forEachChild(n, visit);
  };
  visit(ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS));
  return out;
};

const inLayer = (path: string, layer: string) => path === `/src/${layer}` || path.startsWith(`/src/${layer}/`);

describe('the layers of src/ point one way (#1413)', () => {
  const CANNOT_IMPORT: Record<(typeof LAYERS)[number], string[]> = { curriculum: ['game', 'ui'], game: ['ui'], ui: [] };

  it.each(LAYERS)('src/%s has files, so the rail below is not vacuous', (layer) => {
    expect(inDir(`/src/${layer}/`).length).toBeGreaterThan(0);
  });

  it.each(LAYERS)('src/%s imports no layer above it', (layer) => {
    const bad = inDir(`/src/${layer}/`).flatMap(([file, source]) =>
      importsOf(file, source).filter((to) => CANNOT_IMPORT[layer].some((up) => inLayer(to, up))).map((to) => `${file} -> ${to}`));
    expect(bad, `src/${layer} may not import ${CANNOT_IMPORT[layer].join(' or ') || 'nothing above it'}: move the shared part down a layer`).toEqual([]);
  });

  it('the reader sees a static import, a re-export and a dynamic import, and ignores a package', () => {
    const src = `import { a } from '../ui/x';\nexport * from '../ui/y';\nconst z = import('../ui/z');\nimport ts from 'typescript';\n// import '../ui/no'`;
    expect(importsOf('/src/game/a.ts', src)).toEqual(['/src/ui/x', '/src/ui/y', '/src/ui/z']);
  });
});

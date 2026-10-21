import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import ts from 'typescript';
import { decodeEntities } from './helpers/html-entities';

/**
 * #2092: the guides under website/guides/. A guide quotes the game's own words in `<q>` (a button, a heading, a
 * line on screen) and `<kbd>` (what a grown-up types), so a renamed button must break the build rather than leave
 * a parent hunting for a label that is gone. The labels are matched against the string literals in src/ui/ (read
 * with the TypeScript parser, so a word that only survives in a comment does not count). Browser menu names are
 * written in `<b>`: they are Apple's, Google's and Microsoft's, not the game's, so nothing here can check them.
 */
const root = new URL('../../', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), 'utf8');
const files = (dir: string, ext: string): string[] => readdirSync(new URL(dir, root), { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? files(`${dir}/${e.name}`, ext) : e.name.endsWith(ext) ? [`${dir}/${e.name}`] : []);

const text = (html: string) => decodeEntities(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
/** Every `<q>` and `<kbd>` in a page, as the words a reader sees. */
const quoted = (html: string) => [...html.matchAll(/<(q|kbd)\b[^>]*>([\s\S]*?)<\/\1>/g)].map(m => text(m[2]));

/** The text of every string and template literal in a source file. Comments are not literals, and neither is the
 *  operand of a comparison or a `case`: `e.key === 'Enter'` is a key name, not the Enter button. */
function literals(source: string, name = 'x.ts'): string[] {
  const out: string[] = [];
  const COMPARE = new Set([ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken]);
  const compared = (n: ts.Node) => (ts.isBinaryExpression(n.parent) && COMPARE.has(n.parent.operatorToken.kind)) || ts.isCaseClause(n.parent);
  const walk = (n: ts.Node) => {
    if ((ts.isStringLiteralLike(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) && !compared(n)) out.push(n.text);
    ts.forEachChild(n, walk);
  };
  walk(ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true));
  return out;
}
/**
 * The pieces of text a literal can put on screen whole: the literal itself when it holds no markup, else the text
 * between two tags and the value of a placeholder, aria-label or title. A leading emoji ("👥 Who is playing?") is
 * dropped. A label must equal one piece, so "Restore" inside a sentence, or "Start again" inside "Start again?",
 * does not stand in for a button that was renamed.
 */
function pieces(lit: string): string[] {
  const raw = /[<>]/.test(lit) ? [...lit.split(/<[^>]*>|>/), ...[...lit.matchAll(/\b(?:placeholder|aria-label|title)="([^"]*)"/g)].map(m => m[1])] : [lit];
  return raw.map(s => text(s).replace(/^[^\p{L}\p{N}]+/u, '')).filter(Boolean);
}
/** The quoted labels that are not, whole, a piece of on-screen text in any literal. */
function missing(labels: string[], lits: string[]): string[] {
  const shown = new Set(lits.flatMap(pieces));
  return labels.filter(l => !shown.has(l));
}
const uiLiterals = () => files('src/ui', '.ts').flatMap(f => literals(read(f), f));
const guides = () => files('website/guides', '.html');

describe('the guides quote only labels the game shows (#2092)', () => {
  it('reads labels from <q> and <kbd>, and literals but not comments', () => {
    expect(quoted('<p>Tap <q>Start  again</q>, type <kbd>RESET</kbd>, then <b>Install</b> &amp; <q>Who&#39;s here?</q></p>'))
      .toEqual(['Start again', 'RESET', "Who's here?"]);
    expect(literals("// 'In a comment'\nconst a = 'Plain', b = `<b>Tem ${a} plate</b>`; /* \"Block\" */")).toEqual(['Plain', '<b>Tem ', ' plate</b>']);
  });
  it('flags a label no literal holds, one only in a comment, one inside a sentence, and a key name in a comparison', () => {
    const lits = literals("// 'Hidden label'\nconst x = '<button>Copy the code</button>', y = 'Once upon', s = 'Paste it into <b>Restore</b> later';\n" +
      "if (e.key === 'Enter') go(); const h = '<h2>Start again?</h2>', w = `<button>👥 Who is playing?</button>`, p = '<textarea placeholder=\"Paste here\">';" +
      "const r = `<li>${a}\">Save name</button>`;");
    expect(missing(['Copy the code', 'Hidden label', 'Renamed button', 'On', 'Once', 'Paste it into', 'Restore', 'Enter', 'Start again', 'Who is playing?', 'Paste here', 'Once upon', 'Save name'], lits))
      .toEqual(['Hidden label', 'Renamed button', 'On', 'Once', 'Enter', 'Start again']);
  });
  it('every <q> and <kbd> in every guide is a string the game has in src/ui/', () => {
    const pages = guides();
    expect(pages, 'the pages it reads').toContain('website/guides/parents/index.html');
    const labels = pages.flatMap(p => quoted(read(p)));
    expect(labels.length, 'the labels it checks').toBeGreaterThan(10);
    expect(labels).toEqual(expect.arrayContaining(['For grown-ups', 'Copy the code', 'Restore', 'Start again', 'RESET']));
    const lits = uiLiterals();
    for (const p of pages) expect(missing(quoted(read(p)), lits), `${p} quotes a label src/ui/ does not have`).toEqual([]);
  });
});

describe('the guides index (#2092)', () => {
  const index = read('website/guides/index.html');
  it('links only to guides that exist and are not placeholders', () => {
    const linked = [...index.slice(index.indexOf('<main')).matchAll(/href="(\/guides\/[^"]+)"/g)].map(m => m[1]);
    expect(linked).toContain('/guides/parents/');
    for (const l of linked) {
      const file = `website${l}index.html`;
      expect(existsSync(new URL(file, root)), file).toBe(true);
      expect(read(file), `${file} is a placeholder`).not.toContain('noindex');
    }
  });
  it('is indexable, with its canonical URL', () => {
    expect(index).not.toContain('noindex');
    expect(index).toContain('<link rel="canonical" href="https://sharpwise.co.uk/guides/">');
  });
});

describe('the parents\' guide (#2092)', () => {
  const page = read('website/guides/parents/index.html');
  it('has a section for each task the issue names', () => {
    for (const id of ['install', 'offline', 'grownups', 'profiles', 'move', 'reset', 'settings', 'duel']) {
      expect(page, id).toContain(`<section aria-labelledby="${id}-title">`);
    }
  });
  it('covers installing on iPhone and iPad, Android and a computer', () => {
    for (const h of ['iPhone and iPad (Safari)', 'Android (Chrome)', 'A computer (Chrome or Edge)']) expect(page).toContain(`<h3>${h}</h3>`);
  });
  it('is indexable, with its canonical URL', () => {
    expect(page).not.toContain('noindex');
    expect(page).toContain('<link rel="canonical" href="https://sharpwise.co.uk/guides/parents/">');
  });
});

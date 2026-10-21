import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import ts from 'typescript';

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

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", rsquo: '’', nbsp: ' ' };
const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&(#?\w+);/g, (m, e) => ENTITIES[e] ?? m).replace(/\s+/g, ' ').trim();
/** Every `<q>` and `<kbd>` in a page, as the words a reader sees. */
const quoted = (html: string) => [...html.matchAll(/<(q|kbd)\b[^>]*>([\s\S]*?)<\/\1>/g)].map(m => text(m[2]));

/** The text of every string and template literal in a source file; comments are not literals. */
function literals(source: string, name = 'x.ts'): string[] {
  const out: string[] = [];
  const walk = (n: ts.Node) => {
    if (ts.isStringLiteralLike(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) out.push(n.text);
    ts.forEachChild(n, walk);
  };
  walk(ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true));
  return out;
}
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** The quoted labels no literal holds as whole words ("On" must not pass on "Once"). */
function missing(labels: string[], lits: string[]): string[] {
  const all = lits.flatMap(l => [l, text(l)]).join('\n');   // raw too: a placeholder or aria-label lives inside a tag
  return labels.filter(l => !new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(l)}($|[^\\p{L}\\p{N}])`, 'mu').test(all));
}
const uiLiterals = () => files('src/ui', '.ts').flatMap(f => literals(read(f), f));
const guides = () => files('website/guides', '.html');

describe('the guides quote only labels the game shows (#2092)', () => {
  it('reads labels from <q> and <kbd>, and literals but not comments', () => {
    expect(quoted('<p>Tap <q>Start  again</q>, type <kbd>RESET</kbd>, then <b>Install</b> &amp; <q>Who&#39;s here?</q></p>'))
      .toEqual(['Start again', 'RESET', "Who's here?"]);
    expect(literals("// 'In a comment'\nconst a = 'Plain', b = `<b>Tem ${a} plate</b>`; /* \"Block\" */")).toEqual(['Plain', '<b>Tem ', ' plate</b>']);
  });
  it('flags a label no literal holds, one found only in a comment, and a partial word', () => {
    const lits = literals("// 'Hidden label'\nconst x = '<button>Copy the code</button>', y = 'Once upon';");
    expect(missing(['Copy the code', 'Hidden label', 'Renamed button', 'On', 'Once'], lits)).toEqual(['Hidden label', 'Renamed button', 'On']);
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

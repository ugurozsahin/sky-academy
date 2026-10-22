import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import ts from 'typescript';
import { decodeEntities } from './helpers/html-entities';
import { MAX_PROFILES } from '../../src/storage/profile-index';
import { DUEL_ROUNDS } from '../../src/game/duel';
import { REST_SETTINGS } from '../../src/device-settings';
import { gateChallenge } from '../../src/game/parents';

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
/** A quoted label, and the one src/ui/ file that must hold it when the guide names one (`<q data-src="home.ts">`). */
interface Quote { label: string; src?: string }
/** Every `<q>` and `<kbd>` in a page, as the words a reader sees. */
const quotes = (html: string): Quote[] => [...html.matchAll(/<(q|kbd)\b([^>]*)>([\s\S]*?)<\/\1>/g)]
  .map(m => ({ label: text(m[3]), src: /\bdata-src="([^"]+)"/.exec(m[2])?.[1] }));
const quoted = (html: string) => quotes(html).map(q => q.label);

/** The text of every string and template literal in a source file. Comments are not literals, and neither is the
 *  operand of a comparison or a `case` (`e.key === 'Enter'` is a key name, not the Enter button), nor an argument
 *  of `say(...)`, which is spoken and never on screen. */
function literals(source: string, name = 'x.ts'): string[] {
  const out: string[] = [];
  const COMPARE = new Set([ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken]);
  const compared = (n: ts.Node) => (ts.isBinaryExpression(n.parent) && COMPARE.has(n.parent.operatorToken.kind)) || ts.isCaseClause(n.parent);
  const spoken = (n: ts.Node) => ts.isCallExpression(n.parent) && ts.isIdentifier(n.parent.expression) && n.parent.expression.text === 'say';
  const walk = (n: ts.Node) => {
    if ((ts.isStringLiteralLike(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) && !compared(n) && !spoken(n)) out.push(n.text);
    ts.forEachChild(n, walk);
  };
  walk(ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true));
  return out;
}
/**
 * The pieces of text a literal can put on screen whole: the literal itself when it holds no markup, else the text
 * between two tags and the value of a placeholder or title, and of an aria-label only on an element with no visible
 * text of its own (an icon button): a label repeated beside the words it names would keep a renamed button green. A leading emoji ("👥 Who is playing?") is
 * dropped. A label must equal one piece, so "Restore" inside a sentence, or "Start again" inside "Start again?",
 * does not stand in for a button that was renamed.
 */
const visible = (s: string) => /[\p{L}\p{N}]/u.test(text(s));
/** The aria-labels in a literal that sit on an element with no letters or digits between its tags. */
const iconLabels = (lit: string) => [...lit.matchAll(/<[^<>]*\baria-label="([^"]*)"[^<>]*>([^<]*)/g)].filter(m => !visible(m[2])).map(m => m[1]);
function pieces(lit: string): string[] {
  const raw = /[<>]/.test(lit) ? [...lit.split(/<[^>]*>|>/), ...[...lit.matchAll(/\b(?:placeholder|title)="([^"]*)"/g)].map(m => m[1]), ...iconLabels(lit)] : [lit];
  return raw.map(s => text(s).replace(/^[^\p{L}\p{N}]+/u, '')).filter(Boolean);
}
/** The quoted labels that are not, whole, a piece of on-screen text in any literal. */
function missing(labels: string[], lits: string[]): string[] {
  const shown = new Set(lits.flatMap(pieces));
  return labels.filter(l => !shown.has(l));
}
const uiFiles = () => files('src/ui', '.ts');
const uiLiterals = () => uiFiles().flatMap(f => literals(read(f), f));
/** A guide's quotes that no literal holds: a quote naming its file is matched against that file's literals alone. */
function unmatched(qs: Quote[], all: string[]): string[] {
  const own = new Map<string, string[]>();
  return qs.filter(q => {
    if (!q.src) return missing([q.label], all).length > 0;
    const file = uiFiles().filter(f => f.endsWith(`/${q.src}`));
    if (file.length !== 1) return true;
    if (!own.has(q.src)) own.set(q.src, literals(read(file[0]), file[0]));
    return missing([q.label], own.get(q.src)!).length > 0;
  }).map(q => q.src ? `${q.label} (${q.src})` : q.label);
}
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
    for (const p of pages) expect(unmatched(quotes(read(p)), lits), `${p} quotes a label src/ui/ does not have`).toEqual([]);
  });
  it('does not let a spoken line, a repeated aria-label or another file hold a renamed label', () => {
    const lits = literals("say('Who is playing?'); const a = '<button aria-label=\"For grown-ups\">👤 Parents</button>', b = '<button aria-label=\"Back\">←</button>';");
    expect(missing(['Who is playing?', 'For grown-ups', 'Back'], lits)).toEqual(['Who is playing?', 'For grown-ups']);
    expect(quotes('<q data-src="home.ts">Enter</q> <q>Back</q>')).toEqual([{ label: 'Enter', src: 'home.ts' }, { label: 'Back', src: undefined }]);
    expect(unmatched([{ label: 'Enter', src: 'home.ts' }], uiLiterals()), 'Enter is in parents.ts and keypad.ts, not home.ts').toEqual(['Enter (home.ts)']);
    expect(unmatched([{ label: 'Enter', src: 'nosuch.ts' }], [])).toEqual(['Enter (nosuch.ts)']);
  });
  it('names the owning file for the labels another file also holds', () => {
    const qs = guides().flatMap(p => quotes(read(p)));
    const all = uiFiles().map(f => literals(read(f), f));
    const holders = (label: string) => all.filter(l => missing([label], l).length === 0).length;
    // Enter is the gate button and the keypad's key name; the other two are headings or lines a second screen repeats.
    for (const label of ['Enter', 'Who is playing?', 'For grown-ups']) expect(holders(label), `${label} is held by one file only`).toBeGreaterThan(1);
    const named = qs.filter(q => ['Auto', 'On', 'Off', 'Enter', 'Who is playing?', 'For grown-ups'].includes(q.label));
    expect(named.length, 'the quotes it checks').toBeGreaterThan(6);
    for (const q of named) expect(q.src, `<q>${q.label}</q> must say which src/ui/ file shows it (data-src)`).toBeTruthy();
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
  it('states the numbers the game uses (#2135)', () => {
    expect(page).toContain('Up to four children');
    expect(MAX_PROFILES).toBe(4);
    expect(page).toContain('A match is ten rounds');
    expect(DUEL_ROUNDS).toBe(10);
    expect(page).toContain('a break after 10, 20 or 30 minutes');
    expect(REST_SETTINGS.filter(r => r !== 'off').join(', ')).toBe('10, 20, 30');
    expect(page).toContain('such as 7 × 8');
    for (let i = 0; i < 100; i++) {
      const g = gateChallenge(() => i / 100);
      expect([g.a, g.b].every(n => n >= 6 && n <= 9), `${g.prompt} is a 6–9 table fact`).toBe(true);
    }
  });
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

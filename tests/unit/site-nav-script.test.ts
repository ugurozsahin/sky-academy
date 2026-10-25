import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import ts from 'typescript';

/**
 * #2174: the site's one script. The owner allowed exactly one first-party file, website/nav.js, so the Curriculum
 * menu can close on Escape, an outside press and focus leaving it (W3C APG disclosure navigation). It may open and
 * close a menu and nothing else: these rails hold that it reaches no network, no storage and no cookie, stays
 * small, and is the same deferred tag on every page. pages.test.ts allows that one tag and no other script.
 */
const root = new URL('../../', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), 'utf8');
const pages = (dir = 'website'): string[] => readdirSync(new URL(dir, root), { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? pages(`${dir}/${e.name}`) : e.name.endsWith('.html') ? [`${dir}/${e.name}`] : []);
const TAG = '<script src="/nav.js" defer></script>';

/** The script's tokens with its comments dropped, so a comment saying "nothing is fetched" is not a finding. */
function tokens(source: string): { text: string; strings: string[] } {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, source);
  const out: string[] = [], strings: string[] = [];
  for (let k = scanner.scan(); k !== ts.SyntaxKind.EndOfFileToken; k = scanner.scan()) {
    out.push(scanner.getTokenText());
    if (k === ts.SyntaxKind.StringLiteral || k === ts.SyntaxKind.NoSubstitutionTemplateLiteral) strings.push(scanner.getTokenValue());
    if (k === ts.SyntaxKind.TemplateHead) strings.push('`${`');   // a built string: its parts cannot be read, so it fails
  }
  return { text: out.join(' '), strings };
}
/** Every way a script reaches the network, storage or a cookie that this rail knows to look for. */
const FORBIDDEN: [string, RegExp][] = [
  ['fetch', /\bfetch\b/], ['XMLHttpRequest', /\bXMLHttpRequest\b/], ['sendBeacon', /\bsendBeacon\b/],
  ['import(', /\bimport\s*\(/], ['new Image', /\bnew\s+Image\b/], ['localStorage', /\blocalStorage\b/],
  ['sessionStorage', /\bsessionStorage\b/], ['document.cookie', /\bcookie\b/], ['indexedDB', /\bindexedDB\b/],
  ['WebSocket', /\bWebSocket\b/], ['EventSource', /\bEventSource\b/], ['Worker', /\b(?:Shared)?Worker\b|\bserviceWorker\b/],
  ['eval', /\beval\b|\bFunction\s*\(/], ['src or href set', /\.\s*(?:src|href|srcset)\b/],
  ['address attribute', /\bsetAttribute(?:NS)?\s*\(\s*(?:[^,)]*,\s*)?['"`](?:src|href|srcset|action|formaction|ping|data|poster)['"`]/],
  ['HTML written', /\b(?:innerHTML|outerHTML|insertAdjacentHTML|createContextualFragment|DOMParser|write|writeln)\b/],
  ['navigation', /\blocation\b|\bopen\s*\(|\bsubmit\b/],
  // #2177: ways the first list missed. A relative URL has no slash or colon, so only the name catches these.
  ['other storage or fetch', /\b(?:cookieStore|caches|fetchLater)\b|\bnavigator\s*\.\s*storage\b/],
  ['ping', /\bping\b/], ['style written', /\.\s*(?:style|cssText)\b/],
  ['computed member', /\[\s*(?:['"`]|[^\]]*\+)/],   // window['fe'+'tch']: the name is built, so no word list can read it
];
function reaches(source: string): string[] {
  const { text, strings } = tokens(source);
  const found = FORBIDDEN.filter(([, re]) => re.test(text)).map(([name]) => name);
  // An address needs a slash or a colon: no string in the script may carry one, so it can name no URL; nor may it
  // build a string from parts (a template with a substitution), which this cannot read.
  for (const s of strings) if (/[/:]/.test(s) || s === "`${`") found.push(`string "${s}"`);
  return found;
}

describe('website/nav.js opens the Curriculum menu and does nothing else (#2174)', () => {
  const nav = read('website/nav.js');

  it('reaches no network, storage or cookie, and names no address', () => {
    expect(nav, 'the file it reads').toContain("querySelector('details.nav-years')");
    expect(reaches(nav)).toEqual([]);
  });
  it('flags each way out, one mutation per entry, and not a comment that mentions one', () => {
    const cases: [string, string][] = [
      ['fetch', "fetch('/x')"], ['XMLHttpRequest', 'new XMLHttpRequest()'], ['sendBeacon', 'navigator.sendBeacon(u)'],
      ['import(', "import('./a.js')"], ['new Image', 'new Image()'], ['localStorage', "localStorage.setItem('a', 1)"],
      ['sessionStorage', 'sessionStorage.a = 1'], ['document.cookie', "document.cookie = 'a=1'"], ['indexedDB', 'indexedDB.open(n)'],
      ['WebSocket', 'new WebSocket(u)'], ['EventSource', 'new EventSource(u)'], ['Worker', 'new Worker(u)'],
      ['eval', 'eval(x)'], ['src or href set', 'img.src = u'], ['address attribute', "box.setAttribute('src', u)"],
      ['HTML written', "box.insertAdjacentHTML('beforeend', h)"], ['navigation', "location.assign('x')"],
      ['other storage or fetch', 'cookieStore.set(n)'], ['ping', "a.ping = 'x'"], ['style written', "box.style.background = 'url(x)'"],
      ['computed member', "window['fe' + 'tch']('x')"],
    ];
    expect(cases.map(([name]) => name), 'one case per forbidden entry').toEqual(FORBIDDEN.map(([name]) => name));
    for (const [name, line] of cases) expect(reaches(`${nav}\n${line.replace(/'[^']*[/:][^']*'/g, "'x'")};`), line).toContain(name);
    expect(reaches("const a = 'https://example.com';")).toEqual(['string "https://example.com"']);
    for (const [name, line] of [['other storage or fetch', 'caches.keys()'], ['other storage or fetch', 'navigator.storage.estimate()'], ['other storage or fetch', 'fetchLater(u)'],
      ['style written', 'rule.cssText = c']]) expect(reaches(line), line).toContain(name);
    // Known limit: a key built in a variable (const k = 'fe' + 'tch'; window[k]) passes the computed-member rule; only reading the script can see it.
    expect(reaches("const a = '/x.js';")).toEqual(['string "/x.js"']);
    expect(reaches('const a = `https://x.com/${b}`;'), 'a template with a substitution').toContain('string "`${`"');
    expect(reaches("box.setAttribute('aria-controls', list.id); const open = 1; String(open);"), 'what nav.js itself does').toEqual([]);
    for (const line of ["box.innerHTML = h", "box.outerHTML = h", "window.open(u)", "form.submit()", "document.write(h)"]) expect(reaches(line), line).not.toEqual([]);
    expect(reaches('// nothing is fetched, no fetch(), no localStorage\n/* new Image */ const a = 1;')).toEqual([]);
  });
  it('stays under 2 KB', () => {
    expect(Buffer.byteLength(nav)).toBeLessThan(2048);
  });
  it('every page loads it once, deferred, from the head, and no page carries another script that runs', () => {
    const all = pages();
    expect(all, 'the pages it reads').toEqual(expect.arrayContaining(['website/index.html', 'website/404.html', 'website/curriculum/year-6/index.html']));
    for (const p of all) {
      const html = read(p), head = html.slice(0, html.indexOf('</head>'));
      expect(html.split(TAG).length - 1, `${p}: one ${TAG}`).toBe(1);
      expect(head, `${p}: in the head, after the stylesheet`).toContain(`<link rel="stylesheet" href="/site.css">\n  ${TAG}`);
    }
  });
  it('the generated pages get it from their generators, not by hand', () => {
    for (const g of ['scripts/site-curriculum-lib.mjs', 'scripts/site-features.mjs']) expect(read(g), g).toContain(TAG);
  });
});

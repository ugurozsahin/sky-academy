import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { SOURCES } from './helpers/sources';
import { ABOUT_LINES } from '../../src/ui/about';
import { voiceScore } from '../../src/voice-score';
import { MAX_PROFILES } from '../../src/storage/profile-index';

/**
 * #1934: the /privacy/ and /support/ pages state facts about the game, and the stores read them. Each fact is
 * pinned here to the code that makes it true, so a change to the game that breaks a sentence goes red until the
 * page changes with it. "Collects nothing" is pinned to the #1937 rail (policy #1926) and to the game's own code.
 */
const root = new URL('../../', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), 'utf8');
/** A page's visible words in <main>, tags dropped and whitespace folded, so a sentence can wrap across lines. */
const words = (p: string) => {
  const html = read(p), from = html.indexOf('<main'), to = html.indexOf('</main>');
  if (from < 0 || to < from) throw new Error(`${p}: no <main> … </main> to read`);
  return html.slice(from, to).replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
};
const privacy = words('website/privacy/index.html');
const support = words('website/support/index.html');
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The game's code as shipped: every src .ts and .css file, and the page that loads them. The CSS is read from disk:
 *  Vitest hands an `import.meta.glob` of CSS back as empty strings, even with `?raw`. */
const cssFiles = (dir: string): string[] => readdirSync(new URL(dir, root), { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? cssFiles(`${dir}${e.name}/`) : e.name.endsWith('.css') ? [`${dir}${e.name}`] : []);
const CSS = Object.fromEntries(cssFiles('src/').map(f => [`/${f}`, read(f)]));
const GAME = { ...SOURCES, ...CSS, '/index.html': read('index.html') };

/** Ways the game's own code could send something off the device or set a cookie, each with a line that uses it. */
const NETWORK: [string, RegExp, string][] = [
  ['fetch(', /\bfetch\s*\(/, 'await fetch (u)'], ['XMLHttpRequest', /XMLHttpRequest/, 'new XMLHttpRequest()'],
  ['WebSocket', /WebSocket/, 'new WebSocket(u)'], ['sendBeacon', /sendBeacon/, 'navigator.sendBeacon(u)'],
  ['EventSource', /EventSource/, 'new EventSource(u)'], ['RTCPeerConnection', /RTCPeerConnection/, 'new RTCPeerConnection()'],
  ['document.cookie', /document\.cookie/, 'document.cookie = "a=1"'],
];
/** Absolute URLs the game's code may name: the SVG namespace, its own origin, and hosts that cannot resolve. */
const OWN = [/^http:\/\/www\.w3\.org\/2000\/svg$/, /^https:\/\/sharpwise\.co\.uk(\/|$)/, /^https:\/\/[a-z]+\.invalid$/, /^https:\/\/localhost$/];
function leaks(files: Record<string, string>): string[] {
  return Object.entries(files).flatMap(([path, text]) => [
    ...NETWORK.filter(([, re]) => re.test(text)).map(([name]) => `${path}: ${name}`),
    ...[...text.matchAll(/https?:\/\/[^\s'"`)<>…]+/g)].map(m => m[0]).filter(u => !OWN.some(re => re.test(u))).map(u => `${path}: ${u}`),
  ]);
}

/** Every file that hands something to the clipboard or a share sheet, and the page's entry that names it. */
const LEAVES: Record<string, string> = {
  '/src/ui/parents.ts': 'The save code',
  '/src/ui/parents-share.ts': 'A progress summary',
  '/src/game/parents.ts': 'A progress summary',
  '/src/ui/certificate.ts': 'A certificate',
  '/src/ui/parents-challenge.ts': 'A challenge code',
  '/src/ui/parents-daily.ts': 'Today\'s Daily Sprint result',
  '/src/ui/parents-words.ts': 'the spelling words still to learn',
};
const SENDS = /\bclipboard\b|\.share\s*\(|navigator\.share\b/;

describe('the privacy page: "collects nothing" is held to the code (#1934)', () => {
  it('says the game collects nothing and sets no cookie, on the page and in the at-a-glance list', () => {
    expect(privacy).toContain('Sharpwise collects nothing about your child.');
    expect(privacy).toContain('no accounts, no analytics, no adverts and no cookies, in the game or on this website');
    expect(privacy).toContain('Neither the game nor this website sets a cookie.');
  });
  it('rests on the #1937 no-tracking rail, which still scans the built game and package.json', () => {
    const rail = read('tests/unit/guardrails-no-tracking.test.ts');
    for (const t of ['the built game reaches no tracking domain or SDK', 'package.json holds no analytics or ads package']) expect(rail, t).toContain(`it('${t}'`);
    expect(rail).toContain('expect(trackingHits(built)).toEqual([]);');
    expect(rail).toContain('expect(badPackages(pkg)).toEqual([]);');
  });
  it('the game\'s own code opens no connection, sets no cookie and names no other company\'s host', () => {
    expect(Object.keys(SOURCES).length, 'the src .ts files it reads').toBeGreaterThan(100);
    expect(Object.keys(CSS).length, 'the src .css files it reads').toBeGreaterThan(5);
    expect(Object.values(CSS).every(t => t.length > 0), 'each .css file read with its contents').toBe(true);
    expect(leaks(GAME)).toEqual([]);
  });
  it('goes red on each way of sending something, and on a third-party URL', () => {
    for (const [name, , probe] of NETWORK) expect(leaks({ 'x.ts': probe }), name).toEqual([`x.ts: ${name}`]);
    expect(leaks({ 'x.ts': 'const u = "https://www.google-analytics.com/collect"' })).toEqual(['x.ts: https://www.google-analytics.com/collect']);
    expect(leaks({ 'x.css': '@import url(https://fonts.googleapis.com/css)' })).toEqual(['x.css: https://fonts.googleapis.com/css']);
    expect(leaks({ 'x.ts': '"https://sharpwise.co.uk.evil.com/"' })).toEqual(['x.ts: https://sharpwise.co.uk.evil.com/']);
    expect(leaks({ 'x.ts': 'xmlns="http://www.w3.org/2000/svg" new URL(p, "https://deeplink.invalid")' })).toEqual([]);
  });
  it('the grown-ups\' area in the game makes the same promise', () => {
    expect(ABOUT_LINES).toContain('No tracking — no analytics, and nothing about your child is collected.');
    expect(ABOUT_LINES).toContain('No account — progress is kept on this device.');
  });
});

describe('the privacy page\'s other facts (#1934)', () => {
  it('lists everything the game can copy or share: each file that does is named on the page', () => {
    const senders = Object.keys(SOURCES).filter(p => SENDS.test(SOURCES[p])).sort();
    expect(senders).toEqual(Object.keys(LEAVES).sort());
    for (const [file, entry] of Object.entries(LEAVES)) expect(privacy, file).toContain(entry);
  });
  it('names the controller, the contact address and the ICO complaint route', () => {
    expect(privacy).toContain('Inobil Technology Ltd, the data controller');
    expect(privacy).toContain('support@sharpwise.co.uk');
    expect(privacy).toContain('Information Commissioner\'s Office (ICO)');
    expect(privacy).toContain('ico.org.uk/make-a-complaint');
  });
  it('"up to four children" is the number of profile slots', () => {
    expect(MAX_PROFILES).toBe(4);
    expect(privacy).toContain('Up to four children');
  });
  it('"prefers online voices" is what the voice ranking does, and read aloud is a per-child switch', () => {
    expect(voiceScore({ name: 'A', lang: 'en-GB', localService: false })).toBeGreaterThan(voiceScore({ name: 'A', lang: 'en-GB', localService: true }));
    expect(privacy).toContain('The game prefers those voices');
    expect(SOURCES['/src/ui/home.ts']).toContain('aria-label="Read aloud');
    expect(SOURCES['/src/storage/shape.ts'], 'speech is a field of each save').toMatch(/^\s+speech: boolean;/m);
    expect(privacy).toContain('do this for each ninja on the device');
  });
});

describe('the support page names the game\'s real controls (#1934)', () => {
  const ui = Object.entries(SOURCES).filter(([p]) => p.startsWith('/src/ui/')).map(([, t]) => t).join('\n');
  it('every bold name on the page is a button or a section heading in src/ui', () => {
    const html = read('website/support/index.html');
    const names = [...new Set([...html.matchAll(/<(strong|b)\b[^>]*>([^<]+)<\/\1>/g)].map(m => m[2]))];
    expect(names).toEqual(expect.arrayContaining(['For grown-ups', 'Move to another device', 'Copy the code', 'Restore', 'Who is playing?', 'Start again', 'Undo', 'Remove']));
    for (const n of names) expect(ui, n).toMatch(new RegExp(`<button\\b[^>]*>[^<]*${escape(n)}</button>|<h3 class="p-h">${escape(n)}</h3>`));
  });
  it('the word to type is the game\'s own, and the contact address is a mailto link', () => {
    expect(SOURCES['/src/ui/parents.ts']).toContain("const RESET_WORD = 'RESET';");
    expect(support).toContain('Type RESET in the box');
    expect(read('website/support/index.html')).toContain('<a href="mailto:support@sharpwise.co.uk">support@sharpwise.co.uk</a>');
  });
});

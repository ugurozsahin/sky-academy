import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { timeOptsFor } from '../../src/game/time-options';
import { MODES } from '../../src/game/modes';
import { DEFAULT } from '../../src/storage/shape';

/**
 * #2093, holding the #1291 wording rules on the website: Sharpwise's Tables Check is practice, never the official
 * multiplication tables check, and never presented as made, approved or matched by the STA or the DfE.
 * - Every sentence that names the check, or calls a check or test "official", says "practice" or "practise".
 * - "official" appears only as "not the official" or "not an official".
 * - No sentence anywhere names the STA or the DfE.
 * - No sentence that names the check, and no sentence right after one, claims to be identical, the same as the
 *   real one, approved, endorsed or the only free one.
 * "official" in a sentence that does not name the check ("The official app.") is allowed, pinned below; the game's own
 * parents' settings line (src/ui/parents-settings.ts) names the real check deliberately and is held by parents.test.ts only.
 * Everything a reader, a search result or an AI crawler can meet is read: visible text, titles, alt, title,
 * aria-label and meta content attributes in either quote, the string values of JSON-LD, and website/llms.txt.
 */
const root = new URL('../../', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), 'utf8');
const files = (ext: string, dir = 'website'): string[] => readdirSync(new URL(dir, root), { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? files(ext, `${dir}/${e.name}`) : e.name.endsWith(ext) ? [`${dir}/${e.name}`] : []);

const BLOCK = /<\/?(?:p|li|dt|dd|h[1-6]|td|th|caption|title|figcaption|figure|div|section|ul|ol|dl|tr|table|header|footer|nav|main|head|body|blockquote|article|aside|summary|details|form|label|button)\b[^>]*>/gi;
const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', thinsp: ' ', ensp: ' ', emsp: ' ', shy: '', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', times: '×' };
const decode = (s: string) => s.replace(/\u00ad/g, '').replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
  e[0] !== '#' ? NAMED[e.toLowerCase()] ?? m : String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))));
/** Sentence ends, but not inside "e.g." or "i.e.". */
const split = (s: string) => s.split(/(?<=[.!?])(?<!\be\.g\.)(?<!\bi\.e\.)\s+/);
const tidy = (s: string) => s.replace(/\s+/g, ' ').replace(/ ([.,!?;:])/g, '$1').trim();

/** Every string value in parsed JSON-LD, inside `@graph` too, except `@type`/`@id`/`@context` strings and URLs. */
const jsonStrings = (v: unknown): string[] => typeof v === 'string' ? (/^https?:\/\//.test(v) ? [] : [v])
  : Array.isArray(v) ? v.flatMap(jsonStrings)
  : v && typeof v === 'object' ? Object.entries(v).flatMap(([k, x]) => k.startsWith('@') && typeof x === 'string' ? [] : jsonStrings(x)) : [];

/** Every sentence a reader, a search result or a screen reader can meet in a page. */
function sentences(html: string): string[] {
  const clean = html.replace(/<!--[\s\S]*?-->/g, ' ');
  const ldTags = [...clean.matchAll(/<script\b[^>]*\btype\s*=\s*["']?application\/ld\+json\b[^>]*>([\s\S]*?)<\/script>/gi)];
  if (ldTags.length !== (clean.match(/application\/ld\+json/gi) ?? []).length) throw new Error('a JSON-LD script the rail could not read');
  const ld = ldTags.flatMap(m => jsonStrings(JSON.parse(m[1])));
  const noScript = clean.replace(/<script\b[\s\S]*?<\/script>/gi, ' ');
  const attrs = [...noScript.matchAll(/\s(?:content|alt|title|aria-label|aria-description|placeholder|value)\s*=\s*(?:(["'])([\s\S]*?)\1|([^\s"'=<>`]+))/gi)].map(m => m[2] ?? m[3]);
  const body = noScript.replace(/\s+/g, ' ').replace(/<br\s*\/?>/gi, ' ').replace(BLOCK, '\n').replace(/<[^>]+>/g, ' ');
  return [...ld, ...attrs, ...body.split('\n')].flatMap(s => split(tidy(decode(s)))).filter(Boolean);
}
/** The same for a text file such as llms.txt: one paragraph or list item per line, Markdown links kept as their text. */
const textSentences = (txt: string) => txt.replace(/\n[ \t]+(?=\S)/g, ' ').split('\n').flatMap(l => split(tidy(l.replace(/\]\([^)]*\)/g, ']')))).filter(Boolean);

const NAMES_CHECK = /\bYear 4 (?:multiplication |tables? )?checks?\b|\btables?[ -](?:check|test)s?\b|\b(?:multiplication|times)[- ]tables?[ -](?:check|test)s?\b|\bmultiplication checks?\b|\bMTC\b|\bofficial(?:ly)?\b[^.!?]*\b(?:check|test)s?\b/i;
const BODIES = /\b(?:STA|DfE|Standards (?:and|&) Testing Agency|Department for Education)\b/i;
const CLAIMS = /\b(?:identical|exactly the same|same as the real|endorsed|approved|only free)\b/i;

/** Why each sentence breaks the #1291 rules; [] when none does. */
function wordingProblems(all: string[]): string[] {
  return all.flatMap((s, i) => {
    const names = NAMES_CHECK.test(s), after = i > 0 && NAMES_CHECK.test(all[i - 1]);
    return [
      ...(names && !/\bpractices?\b|\bpractis(?:e|es|ed|ing)\b/i.test(s) ? [`no "practice": ${s}`] : []),
      ...(names && /\bofficial(?:ly)?\b/i.test(s.replace(/\bnot (?:the|an) official\b/gi, '')) ? [`"official" not as "not the official": ${s}`] : []),
      ...(BODIES.test(s) ? [`names the STA or the DfE: ${s}`] : []),
      ...((names || after) && CLAIMS.test(s) ? [`claims a match: ${s}`] : []),
    ];
  });
}
const pageProblems = (html: string) => wordingProblems(sentences(html));

describe('the website never presents Tables Check practice as the official check (#2093, #1291)', () => {
  it('reads text, titles, attributes in either quote and JSON-LD strings, across line breaks and entities, but not comments', () => {
    expect(sentences('<title>A. B</title><!-- C. --><p>One <q>two</q>.\n  Three?</p><img alt=\'Four.\'><p>Tables<br>Check&#160;&amp; e.g. this.</p>' +
      '<script type="application/ld+json">{"@type": "Thing", "url": "https://sharpwise.co.uk/", "description": "Five."}</script>'))
      .toEqual(['Five.', 'Four.', 'A.', 'B', 'One two.', 'Three?', 'Tables Check & e.g. this.']);
    expect(textSentences('- [Teachers](https://sharpwise.co.uk/x/): one. Two')).toEqual(['- [Teachers]: one.', 'Two']);
    expect(sentences('<script type="application/ld+json">{"@context": "https://schema.org", "@graph": [{"@type": "VideoGame", "@id": "x#game", ' +
      '"name": "Six.", "offers": {"@type": "Offer", "description": "Seven."}}]}</script>')).toEqual(['Six.', 'Seven.']);
  });
  it('flags each way a sentence can break the rule', () => {
    expect(pageProblems('<p>Sit the Multiplication Tables Check here.</p>')).toEqual(['no "practice": Sit the Multiplication Tables Check here.']);
    for (const name of ['multiplication table check', 'Year 4 multiplication check', 'times tables test', 'MTC', 'Tables&#160;Check', 'tables\n check', 'Year 4 tables test', 'multiplication tables checks', 'Year 4 check', 'Year 4 tables checks']) {
      expect(pageProblems(`<p>Try the ${name}.</p>`), name).toHaveLength(1);
    }
    expect(pageProblems('<meta name="description" content="Practise for the official multiplication tables check.">'))
      .toEqual(['"official" not as "not the official": Practise for the official multiplication tables check.']);
    expect(pageProblems('<p>Tables Check practice, officially.</p>')).toHaveLength(1);
    expect(pageProblems('<meta name="description" content="Sit the official\n  multiplication tables check.">')).toHaveLength(2);
    expect(pageProblems('<article>Tables Check practice</article><aside>It is endorsed.</aside>')).toEqual(['claims a match: It is endorsed.']);
    expect(pageProblems('<span>Tables Check</span><span>practice, endorsed.</span>')).toEqual(['claims a match: Tables Check practice, endorsed.']);
    expect(pageProblems('<p>Questions written by the DfE.</p>')).toEqual(['names the STA or the DfE: Questions written by the DfE.']);
    expect(pageProblems('<p>Tables Check practice is free. It is approved by teachers.</p>')).toEqual(['claims a match: It is approved by teachers.']);
    expect(pageProblems('<p>Tables Check practice, exactly the same as the real one.</p>')).toHaveLength(1);
    expect(pageProblems('<script type="application/ld+json">{"description": "The official MTC app."}</script>')).toHaveLength(2);
    expect(pageProblems('<p>This is the official check.</p>')).toHaveLength(2);
    expect(pageProblems('<p>It is identical to the Year 4 check, and it is official.</p>')).toHaveLength(3);
    expect(pageProblems('<script type="application/ld+json">{"@graph": [{"@type": "VideoGame", "description": "The official multiplication tables check, approved by the DfE."}]}</script>'))
      .toHaveLength(4);
  });
  it('reads the shapes and spellings a page edit could plausibly produce (#2152)', () => {
    const bad = (html: string) => expect(pageProblems(html), html).not.toEqual([]);
    bad('<script id="ld" type="application/ld+json">{"description":"Sit the official MTC."}</script>');
    bad('<img alt=MTC>');
    bad('<input placeholder="Sit the official MTC">');
    bad('<img alt = "Sit the Tables Check">');
    bad('<p aria-description="Sit the Tables Check"></p>');
    bad('<p>Sit the Ta&shy;bles Check.</p>');
    bad('<p>Sit the Tables&thinsp;Check.</p>');
    bad('<p>Sit the tables-check.</p>');
    bad('<p>A practical way to sit the multiplication tables check.</p>');
    bad('<p>Tables Check practice, approved by the Standards &amp; Testing Agency.</p>');
    expect(() => sentences('<script type="application/ld+json" data-x="1">{}</script><script type=\'application/ld+json\'>{</script>')).toThrow();
    expect(() => sentences('<script src="x.js" data-type="application/ld+json"></script>')).toThrow();
    expect(textSentences('- Tables Check practice,\n  the official one.').filter(s => NAMES_CHECK.test(s))).toEqual(['- Tables Check practice, the official one.']);
    expect(pageProblems('<p>Tables Check practice.</p><p>The official app.</p>'), 'official outside a sentence naming the check').toEqual([]);
  });
  it('passes the right wording, and a check or an approval that is not this one', () => {
    expect(pageProblems('<p>Tables Check practice is practice only, not the official multiplication tables check. A quick check, not a password. ' +
      'It is not an official tables check, only practice. The official app. Approved by nobody.</p>')).toEqual([]);
  });
  it('holds on every page under website/ and in llms.txt, the teachers\' guide among them', () => {
    const pages = files('.html');
    expect(pages).toContain('website/guides/teachers/index.html');
    const naming = pages.filter(p => sentences(read(p)).some(s => NAMES_CHECK.test(s)));
    expect(naming, 'the pages that name the check').toEqual(expect.arrayContaining(['website/guides/teachers/index.html', 'website/features/index.html']));
    for (const p of pages) expect(pageProblems(read(p)), p).toEqual([]);
    expect(textSentences(read('website/llms.txt')).some(s => NAMES_CHECK.test(s)), 'llms.txt names the check').toBe(true);
    expect(wordingProblems(textSentences(read('website/llms.txt')))).toEqual([]);
  });
});

describe('the teachers\' guide (#2093)', () => {
  const page = read('website/guides/teachers/index.html');
  it('has a section for each part the issue names, and links the curriculum page', () => {
    for (const id of ['devices', 'class', 'privacy', 'curriculum', 'tables']) expect(page, id).toContain(`<section aria-labelledby="${id}-title">`);
    expect(page).toContain('href="/curriculum/"');
  });
  it('states the time settings as the game applies them (#2142 review round 2)', () => {
    expect(page).toContain('so 9 seconds in Tables Check practice');
    expect((MODES.mtc.questionMs ?? 0) * (timeOptsFor('mtc', { timeX: 1.5, slow: false }).timeScale ?? 1)).toBe(9000);
    expect(page).toContain('though a Ninja Sprint gets 90 seconds instead');
    expect(MODES.sprint.title).toBe('Ninja Sprint');
    expect(timeOptsFor('sprint', { timeX: 0, slow: false }).seconds).toBe(90);
    expect(timeOptsFor('mtc', { timeX: 0, slow: false }).timeScale).toBe(Infinity);
    expect(page).toContain('Guest play and Whiteboard mode always use the normal time');
    expect(DEFAULT.settings.timeX, 'a guest save starts from DEFAULT (startGuest)').toBe(1);
  });
  it('is indexable, with its canonical URL', () => {
    expect(page).not.toContain('noindex');
    expect(page).toContain('<link rel="canonical" href="https://sharpwise.co.uk/guides/teachers/">');
  });
});

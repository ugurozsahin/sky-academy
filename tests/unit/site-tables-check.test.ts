import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

/**
 * #2093, holding the #1291 wording rules on the website: Sharpwise's Tables Check is practice, never the official
 * multiplication tables check, and never presented as made, approved or matched by the STA or the DfE. Every
 * sentence on a website/ page that names the check (or calls a check "official") must say "practice" or
 * "practise"; "official" may only appear as "not the official"; and none of those sentences may name the STA or the
 * DfE, or claim to be identical, approved, endorsed or the only free one. Visible text, titles and the alt,
 * title, aria-label and meta content attributes are all read, because search results and screen readers show them.
 */
const root = new URL('../../', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), 'utf8');
const pages = (dir = 'website'): string[] => readdirSync(new URL(dir, root), { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? pages(`${dir}/${e.name}`) : e.name.endsWith('.html') ? [`${dir}/${e.name}`] : []);

const BLOCK = /<\/?(?:p|li|dt|dd|h[1-6]|td|th|caption|title|figcaption|figure|div|section|ul|ol|dl|tr|table|header|footer|nav|main|br|head|body)\b[^>]*>/gi;
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };

/** Every sentence a reader, a search result or a screen reader can meet on the page. */
function sentences(html: string): string[] {
  const clean = html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<script\b[\s\S]*?<\/script>/gi, ' ');
  const attrs = [...clean.matchAll(/\s(?:content|alt|title|aria-label)="([^"]*)"/g)].map(m => m[1]);
  const body = clean.replace(BLOCK, '\n').replace(/<[^>]+>/g, '');
  return [...attrs, ...body.split('\n')]
    .map(s => s.replace(/&(#?\w+);/g, (m, e) => ENTITIES[e] ?? m).replace(/\s+/g, ' ').trim())
    .flatMap(s => s.split(/(?<=[.!?])\s+/))
    .filter(Boolean);
}

const NAMES_CHECK = /tables check|\bMTC\b|\bofficial\b[^.!?]*\bcheck\b/i;
const FORBIDDEN = /\b(?:STA|DfE|Standards and Testing Agency|Department for Education|identical|endorsed|approved|only free)\b/i;

/** Why each sentence that names the check breaks the #1291 rules; [] when none does. */
function wordingProblems(html: string): string[] {
  return sentences(html).filter(s => NAMES_CHECK.test(s)).flatMap(s => [
    ...(/\bpracti[cs]e/i.test(s) ? [] : [`no "practice": ${s}`]),
    ...(/\bofficial\b/i.test(s.replace(/\bnot the official\b/gi, '')) ? [`"official" not as "not the official": ${s}`] : []),
    ...(FORBIDDEN.test(s) ? [`names a body or claims a match: ${s}`] : []),
  ]);
}

describe('the website never presents Tables Check practice as the official check (#2093, #1291)', () => {
  it('reads sentences from text, titles and attributes, but not comments or JSON-LD', () => {
    expect(sentences('<title>A. B</title><!-- C. --><p>One <q>two</q>. Three?</p><img alt="Four."><script type="application/ld+json">{"x": "Five."}</script>'))
      .toEqual(['Four.', 'A.', 'B', 'One two.', 'Three?']);
  });
  it('flags each way a sentence can break the rule, and passes the right wording', () => {
    expect(wordingProblems('<p>Sit the Multiplication Tables Check here.</p>')).toEqual(['no "practice": Sit the Multiplication Tables Check here.']);
    expect(wordingProblems('<meta name="description" content="Practise for the official multiplication tables check.">'))
      .toEqual(['"official" not as "not the official": Practise for the official multiplication tables check.']);
    expect(wordingProblems('<p>MTC practice, identical to the DfE one.</p>')).toEqual(['names a body or claims a match: MTC practice, identical to the DfE one.']);
    expect(wordingProblems('<p>This is the official check.</p>')).toHaveLength(2);
    expect(wordingProblems('<p>Tables Check practice is practice only, not the official multiplication tables check. A quick check, not a password. The official app.</p>')).toEqual([]);
  });
  it('holds on every page under website/, the teachers\' guide among them', () => {
    const all = pages();
    expect(all).toContain('website/guides/teachers/index.html');
    const naming = all.filter(p => sentences(read(p)).some(s => NAMES_CHECK.test(s)));
    expect(naming, 'the pages that name the check').toEqual(expect.arrayContaining(['website/guides/teachers/index.html', 'website/features/index.html']));
    for (const p of all) expect(wordingProblems(read(p)), p).toEqual([]);
  });
});

describe('the teachers\' guide (#2093)', () => {
  const page = read('website/guides/teachers/index.html');
  it('has a section for each part the issue names, and links the curriculum page', () => {
    for (const id of ['devices', 'class', 'privacy', 'curriculum', 'tables']) expect(page, id).toContain(`<section aria-labelledby="${id}-title">`);
    expect(page).toContain('href="/curriculum/"');
  });
  it('is indexable, with its canonical URL', () => {
    expect(page).not.toContain('noindex');
    expect(page).toContain('<link rel="canonical" href="https://sharpwise.co.uk/guides/teachers/">');
  });
});

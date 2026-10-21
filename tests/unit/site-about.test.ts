import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ABOUT_LINES, aboutLines } from '../../src/ui/about';

/**
 * #2091: the website's About page promises only what the game's own About screen does. `aboutLines()` is the
 * list the grown-ups' area shows and tests/unit/parents.test.ts pins, so a promise the site makes and the game
 * does not is a failure here, not a review finding.
 *
 * Every word of <main> is held: the promises section must read exactly heading, intro, items, and the prose
 * around it is pinned word for word. A claim added in any element, in any case of tag, changes a pinned text.
 */
const page = readFileSync(new URL('../../website/about/index.html', import.meta.url), 'utf8');
const main = page.slice(page.indexOf('<main'), page.indexOf('</main>'));
const section = (id: string) => {
  const at = main.indexOf(`<section aria-labelledby="${id}">`);
  return at < 0 ? '' : main.slice(at, main.indexOf('</section>', at));
};
const text = (html: string) => html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/\s+/g, ' ').trim();
const promisesHtml = section('promises-title');
const promises = [...promisesHtml.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li\s*>/gi)].map(m => text(m[1]));
const INTRO = "The game shows the same promises in its grown-ups' area, so this page never says more than the game does.";
/** Everything <main> says outside the promises section. A change here is a change to this list, seen in review. */
const PROSE = [
  'About Sharpwise',
  'Sharpwise is a maths and English learning game for children in Reception to Year 6. This page says who makes it, what it teaches and the promises it keeps.',
  'Who makes Sharpwise',
  'Sharpwise is made by Inobil Technology Ltd, a UK company.',
  'What it is',
  'Sharpwise is for children aged 4 to 11, from Reception to Year 6. A question appears, answers float up in bubbles, and your child slices the right one.',
  'Years 1 to 6 are aligned to the National Curriculum for England, and Reception follows the EYFS Early Learning Goals. Each school year has its own topics, in the order children meet them in class.',
  'See every topic on the curriculum page',
].join(' ');
/** Stems a promise is made of. None may appear in the title or a meta tag; the share picture's alt is its own. */
const PROMISE_WORDS = /\b(advert|ads?\b|account|sign[- ]?up|log ?in|track|analytic|offline|internet|cookie|free|collect|personal|data\b|gdpr|privacy|private|safe|secure)/i;

describe('the About page (#2091)', () => {
  it('has a promises section with a list to read', () => {
    expect(promisesHtml, 'the section the rail reads').not.toBe('');
    expect(promises.length).toBeGreaterThan(0);
  });
  it('the promises section says nothing but its heading, its intro and its items, whatever the element', () => {
    expect(promisesHtml.match(/<li\b/gi)?.length, 'an item the regex skipped').toBe(promises.length);
    expect(text(promisesHtml)).toBe(['Our promises', INTRO, ...promises].join(' '));
  });
  it('the rest of <main> is pinned word for word, so no claim slips in as prose', () => {
    expect(text(main.replace(promisesHtml, ''))).toBe(PROSE);
  });
  it('the title and meta tags make no promise', () => {
    const head = page.slice(0, page.indexOf('</head>')).replace(/<!--[\s\S]*?-->/g, '');
    const said = [
      ...[...head.matchAll(/<title>([^<]*)<\/title>/gi)].map(m => m[1]),
      ...[...head.matchAll(/<meta\b([^>]*)>/gi)].filter(m => !/image:alt/i.test(m[1]))
        .map(m => m[1].match(/\bcontent=(?:"([^"]*)"|'([^']*)')/i)).flatMap(c => c ? [c[1] ?? c[2]] : []),
    ];
    expect(said.length).toBeGreaterThan(3);
    for (const t of said) expect(t.match(PROMISE_WORDS)?.[0], t).toBeUndefined();
  });
  it('JSON-LD in <head> makes no promise either: every string value is held to the same words', () => {
    const head = page.slice(0, page.indexOf('</head>')).replace(/<!--[\s\S]*?-->/g, '');
    const strings = (v: unknown): string[] => typeof v === 'string' ? [v]
      : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : [];
    const said = [...head.matchAll(/<script\b[^>]*\btype=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script\s*>/gi)]
      .flatMap(m => strings(JSON.parse(m[1])));
    for (const t of said) expect(t.match(PROMISE_WORDS)?.[0], t).toBeUndefined();
  });
  it('every promise on the page appears, word for word, in aboutLines()', () => {
    const game = aboutLines();
    for (const p of promises) expect(game, p).toContain(p);
  });
  it('makes all four of the game\'s headline promises: no adverts, no account, no tracking, works offline', () => {
    expect(promises).toEqual(expect.arrayContaining([...ABOUT_LINES]));
  });
  it('says who makes Sharpwise and links what it covers to the curriculum page', () => {
    expect(text(section('who-title'))).toContain('Inobil Technology Ltd, a UK company');
    expect(section('what-title')).toContain('href="/curriculum/"');
  });
  it('is no longer a placeholder: no robots meta at all, and its canonical URL', () => {
    expect(page).not.toMatch(/<meta name="robots"/i);
    expect(page).toContain('<link rel="canonical" href="https://sharpwise.co.uk/about/">');
  });
});

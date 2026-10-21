import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ABOUT_LINES, aboutLines } from '../../src/ui/about';

/**
 * #2091: the website's About page promises only what the game's own About screen does. `aboutLines()` is the
 * list the grown-ups' area shows and tests/unit/parents.test.ts pins, so a promise the site makes and the game
 * does not is a failure here, not a review finding.
 */
const page = readFileSync(new URL('../../website/about/index.html', import.meta.url), 'utf8');
const section = (id: string) => {
  const at = page.indexOf(`<section aria-labelledby="${id}">`);
  return at < 0 ? '' : page.slice(at, page.indexOf('</section>', at));
};
const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/\s+/g, ' ').trim();
const promises = [...section('promises-title').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map(m => text(m[1]));
/** Words a promise is made of. Outside the promises list, none may appear, so a claim cannot slip in as prose. */
const PROMISE_WORDS = /\b(advert|account|track|analytic|offline|cookie|free|collect|privacy|safe|secure)/i;

describe('the About page (#2091)', () => {
  it('has a promises section with a list to read', () => {
    expect(section('promises-title'), 'the section the rail reads').not.toBe('');
    expect(promises.length).toBeGreaterThan(0);
  });
  it('the promises section holds its heading, its fixed intro and its items, and nothing else', () => {
    const sec = section('promises-title');
    expect(sec.match(/<li\b/gi)?.length, 'an item the regex skipped').toBe(promises.length);
    expect(sec.match(/<ul\b/gi)?.length).toBe(1);
    expect(text(sec)).toBe([
      'Our promises',
      "The game shows the same promises in its grown-ups' area, so this page never says more than the game does.",
      ...promises,
    ].join(' '));
  });
  it('no promise is made anywhere else: not in <main> outside the list, the title or a meta tag (the shared shell aside)', () => {
    const main = page.slice(page.indexOf('<main'), page.indexOf('</main>'));
    expect(main).toContain('promises-title');
    const rest = main.replace(section('promises-title'), '');
    const metas = [...page.matchAll(/<(?:title>([^<]*)<\/title|meta [^>]*content="([^"]*)")/g)].map(m => m[1] ?? m[2]);
    for (const t of [text(rest), ...metas]) expect(t.match(PROMISE_WORDS)?.[0], t.slice(0, 80)).toBeUndefined();
  });
  it('every promise on the page appears, word for word, in aboutLines()', () => {
    const game = aboutLines();
    for (const p of promises) expect(game, p).toContain(p);
  });
  it('makes all four of the game\'s headline promises: no adverts, no account, no tracking, works offline', () => {
    expect(promises).toEqual(expect.arrayContaining([...ABOUT_LINES]));
  });
  it('says who makes Sharpwise and what it covers, and links to the curriculum page', () => {
    const who = text(section('who-title')), what = text(section('what-title'));
    expect(who).toContain('Inobil Technology Ltd, a UK company');
    expect(what).toContain('Reception to Year 6');
    expect(what).toContain('National Curriculum');
    expect(section('what-title')).toContain('href="/curriculum/"');
  });
  it('is no longer a placeholder: indexable, with its canonical URL', () => {
    expect(page).not.toContain('noindex');
    expect(page).toContain('<link rel="canonical" href="https://sharpwise.co.uk/about/">');
  });
});

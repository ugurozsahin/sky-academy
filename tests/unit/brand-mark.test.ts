import { readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SOURCES } from './helpers/sources';

// #2136: the mark is 賢 (wise), chosen by the owner for the Sharpwise name; it replaced 忍 (ninja). The old
// mark sat in the favicon, the title header, the Android icon script and its docs. This rail keeps it from
// coming back in the places the issue names, and checks the new mark is really there, so deleting the mark
// cannot pass it. The ninja avatars and the word "ninja" are not the mark and are not touched.
const OLD = '忍';
// The old mark in any spelling a rewrite could use: literal, \u5fcd in TS or Python, an HTML reference, or a URL escape (#2157).
const OLD_ANY = /忍|\\u5fcd|&#x0*5fcd;|&#0*24525;|%e5%bf%8d/i;
// Any span whose class list holds the word "kanji", with its attributes in any order.
const KANJI_SPAN = /<span\b(?=[^>]*\bclass=["'][^"']*\bkanji\b)[^>]*>[^<]*<\/span>/g;
const NEW = '賢';
const ROOT = new URL('../../', import.meta.url);
const BINARY = /\.(png|webp|jpe?g|gif|ico|woff2?|ttf|otf|ttc|mp3|ogg|wav|zip|apk|aab)$/i;

/** Every text file under `dir`, or the file itself. Throws on none, so a moved folder cannot pass vacuously. */
function textFiles(rel: string): string[] {
  const url = new URL(rel, ROOT);
  if (statSync(url).isFile()) return [rel];
  const names = (readdirSync(url, { recursive: true }) as string[]).map((n) => `${rel}/${n}`);
  const files = names.filter((n) => !BINARY.test(n) && statSync(new URL(n, ROOT)).isFile());
  if (files.length === 0) throw new Error(`no text files under ${rel} — the mark rail would pass vacuously`);
  return files;
}

describe('the 賢 mark (#2136)', () => {
  it(`no ${OLD} in src/, index.html, scripts/ or website/`, () => {
    const hits = ['src', 'index.html', 'scripts', 'website']
      .flatMap(textFiles)
      .filter((f) => OLD_ANY.test(readFileSync(new URL(f, ROOT), 'utf8')));
    expect(hits).toEqual([]);
  });

  it('the old-mark matcher catches every spelling and spares the new mark', () => {
    for (const spelling of [OLD, '\\u5fcd', '&#x5FCD;', '&#24525;', '%E5%BF%8D']) expect(OLD_ANY.test(`x ${spelling} y`)).toBe(true);
    expect(OLD_ANY.test(`${NEW} %E8%B3%A2 &#x8CE2;`)).toBe(false);
  });

  it('the kanji-span matcher finds a span in any attribute order and class list', () => {
    const spans = (h: string) => h.match(KANJI_SPAN) ?? [];
    expect(spans(`<span aria-hidden="true" class="kanji">x</span>`)).toHaveLength(1);
    expect(spans(`<span class="kanji big" id="a">x</span>`)).toHaveLength(1);
    expect(spans(`<span class="kanjis">x</span><span class="other">y</span>`)).toHaveLength(0);
  });

  it('the favicon draws the new mark', () => {
    const icon = readFileSync(new URL('index.html', ROOT), 'utf8').match(/<link rel="icon" href="([^"]+)"/)?.[1] ?? '';
    expect(icon).toContain(`%3E${NEW}%3C/text%3E`);
  });

  it('every title header shows the new mark, hidden from screen readers', () => {
    const kanji = Object.values(SOURCES).flatMap((s) => s.match(KANJI_SPAN) ?? []);
    expect(kanji.length).toBeGreaterThanOrEqual(4);
    for (const k of kanji) {
      expect(k).toContain('aria-hidden="true"');
      expect(k).toMatch(new RegExp(`>${NEW}</span>$`));
    }
  });

  it('the Android icon script draws the new mark', () => {
    expect(readFileSync(new URL('scripts/android-assets.py', ROOT), 'utf8')).toContain(`MARK = '${NEW}'`);
  });
});

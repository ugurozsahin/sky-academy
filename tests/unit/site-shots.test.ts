import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { shotFiles, SHOTS, SIZES, MAX_BYTES, gateProduct, isWebp, oversized } from '../../scripts/site-shots.mjs';

const root = new URL('../../', import.meta.url).pathname;
const pages = (dir: string): string[] => readdirSync(root + dir, { withFileTypes: true, recursive: true })
  .filter(e => e.isFile() && /\.(html|css)$/.test(e.name)).map(e => `${e.parentPath}/${e.name}`);

/** #2088: the website's pictures are made at deploy time from fixed seeds; none is ever committed. */
describe('site screenshots (#2088)', () => {
  it('commits no image under website/img/', () => {
    const tracked = execFileSync('git', ['ls-files', 'website/img'], { cwd: root, encoding: 'utf8' }).trim();
    expect(tracked, 'an image under website/img/ is tracked').toBe('');
  });
  it('tracks nothing under site-shots/ and git-ignores it', () => {
    expect(execFileSync('git', ['ls-files', 'site-shots'], { cwd: root, encoding: 'utf8' }).trim()).toBe('');
    expect(() => execFileSync('git', ['check-ignore', '-q', 'site-shots/x.webp'], { cwd: root }), 'site-shots/ is not ignored').not.toThrow();
  });
  it('makes a phone and a desktop file for every shot, each named once', () => {
    const files: string[] = shotFiles();
    expect(files).toHaveLength(SHOTS.length * Object.keys(SIZES).length);
    expect(new Set(files).size).toBe(files.length);
    expect(files.every(f => /^[a-z-]+-(phone|desktop)\.webp$/.test(f))).toBe(true);
  });
  // The extraction is a function so it can be proved on a fixture: website/ holds no /img/ reference yet, and an
  // empty `refs` would pass whatever the regex did.
  const missing = (html: string) => {
    const made = new Set<string>(shotFiles());
    return [...html.matchAll(/(?:^|["'(\s/,])img\/([\w.-]+\.webp)/g)].map(m => m[1]).filter(r => !made.has(r));
  };
  it('flags a missing picture however it is spelt, and passes one the deploy makes', () => {
    expect(missing('<img src="/img/sky-map-phone.webp">')).toEqual([]);
    expect(missing('<img src="/img/nope-phone.webp"> <img src="/img/slice-desktop.webp">')).toEqual(['nope-phone.webp']);
    expect(missing('<img src="img/nope-phone.webp">')).toEqual(['nope-phone.webp']);
    expect(missing('<img srcset="img/x-phone.webp 1x, img/y-phone.webp 2x">')).toEqual(['x-phone.webp', 'y-phone.webp']);
    expect(missing('.hero { background: url(img/nope-desktop.webp) }')).toEqual(['nope-desktop.webp']);
    expect(missing('.hero { background: url("../img/nope-desktop.webp") }')).toEqual(['nope-desktop.webp']);
    expect(missing('<img src="img/sky-map-phone.webp">')).toEqual([]);
  });
  it('every img/<name>.webp a website page or stylesheet references is in the shot list', () => {
    expect(pages('website').length, 'the files it reads').toBeGreaterThan(0);
    expect(pages('website').flatMap(p => missing(readFileSync(p, 'utf8'))), 'a page points at a picture the deploy does not make').toEqual([]);
  });
  it('tells WebP from the PNG that toDataURL falls back to', () => {
    expect(isWebp(Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'latin1'))).toBe(true);
    expect(isWebp(Buffer.from('\x89PNG\r\n\x1a\n\0\0\0\rIHDR', 'latin1'))).toBe(false);
  });
  it('holds each file to 150 KB and reads the grown-ups gate in digits and words', () => {
    expect(oversized([{ file: 'a.webp', bytes: MAX_BYTES }, { file: 'b.webp', bytes: MAX_BYTES + 1 }])).toEqual([`b.webp (${MAX_BYTES + 1} bytes)`]);
    expect(MAX_BYTES).toBe(150 * 1024);
    expect(gateProduct('6 × 8')).toBe(48);
    expect(gateProduct('thirty-seven times twenty-four')).toBe(888);
  });
});

/** #2106: a shot of a broken screen must fail the deploy, and a picture's alt text must not name a seeded sum. */
describe('site screenshots fail loudly (#2106)', () => {
  const src = readFileSync(root + 'scripts/site-shots.mjs', 'utf8');
  it('records failed requests and responses of 400 or above as errors', () => {
    expect(src).toContain("page.on('requestfailed'");
    expect(src).toMatch(/page\.on\('response', r => \{ if \(r\.status\(\) >= 400\) errors\.push/);
  });
  it('keeps the home ten-frame alt text free of a sum', () => {
    const html = readFileSync(root + 'website/index.html', 'utf8');
    const alt = /ten-frame-phone\.webp"[^>]*?alt="([^"]*)"/s.exec(html)?.[1] ?? '';
    expect(alt, 'the ten-frame alt text').not.toBe('');
    expect(alt).not.toMatch(/\d\s*[+−-]\s*[?\d]|=/);
  });
});

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { shotFiles, SHOTS, SIZES, MAX_BYTES, gateProduct, isWebp } from '../../scripts/site-shots.mjs';

const root = new URL('../../', import.meta.url).pathname;
const pages = (dir: string): string[] => readdirSync(root + dir, { withFileTypes: true, recursive: true })
  .filter(e => e.isFile() && e.name.endsWith('.html')).map(e => `${e.parentPath}/${e.name}`);

/** #2088: the website's pictures are made at deploy time from fixed seeds; none is ever committed. */
describe('site screenshots (#2088)', () => {
  it('commits no image under website/img/', () => {
    const tracked = execFileSync('git', ['ls-files', 'website/img'], { cwd: root, encoding: 'utf8' }).trim();
    expect(tracked, 'an image under website/img/ is tracked').toBe('');
  });
  it('tracks nothing under site-shots/ and git-ignores it', () => {
    expect(execFileSync('git', ['ls-files', 'site-shots'], { cwd: root, encoding: 'utf8' }).trim()).toBe('');
    expect(readFileSync(root + '.gitignore', 'utf8').split('\n')).toContain('site-shots/');
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
    return [...html.matchAll(/\/img\/([\w.-]+\.webp)/g)].map(m => m[1]).filter(r => !made.has(r));
  };
  it('flags a /img/ reference to a file the deploy does not make, and passes one it does', () => {
    expect(missing('<img src="/img/sky-map-phone.webp">')).toEqual([]);
    expect(missing('<img src="/img/nope-phone.webp"> <img src="/img/slice-desktop.webp">')).toEqual(['nope-phone.webp']);
  });
  it('every /img/<name>.webp a website page references is in the shot list', () => {
    expect(pages('website').length, 'the pages it reads').toBeGreaterThan(0);
    expect(pages('website').flatMap(p => missing(readFileSync(p, 'utf8'))), 'a page points at a picture the deploy does not make').toEqual([]);
  });
  it('tells WebP from the PNG that toDataURL falls back to', () => {
    expect(isWebp(Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'latin1'))).toBe(true);
    expect(isWebp(Buffer.from('\x89PNG\r\n\x1a\n\0\0\0\rIHDR', 'latin1'))).toBe(false);
  });
  it('holds each file to 150 KB and reads the grown-ups gate in digits and words', () => {
    expect(MAX_BYTES).toBe(150 * 1024);
    expect(gateProduct('6 × 8')).toBe(48);
    expect(gateProduct('thirty-seven times twenty-four')).toBe(888);
  });
});

/** #2102: a local preview must never be a picture of an older build, and must never outlive the run. */
describe('npm run site:shots (#2102)', () => {
  const script: string = JSON.parse(readFileSync(root + 'package.json', 'utf8')).scripts['site:shots'];
  it('fails before building when port 4399 already answers', () => {
    expect(script.indexOf("port 4399 is busy")).toBeGreaterThan(-1);
    expect(script.indexOf('port 4399 is busy')).toBeLessThan(script.indexOf('npm run build'));
  });
  it('kills the preview on exit, Ctrl-C and termination', () => {
    expect(script).toMatch(/trap 'kill \$P 2>\/dev\/null' EXIT INT TERM/);
  });
});

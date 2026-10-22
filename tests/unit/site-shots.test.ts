import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { YEARS, topicById } from '../../src/curriculum';
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

/** #2146: a guide's alt text names the year of the shot it describes, and the shot's `run` reads the data it is railed to. */
describe('guide alt texts match their shots (#2146)', () => {
  type Shot = { name: string; year?: string; topic?: string };
  const titles = YEARS.map(y => y.title);
  /** The problems with every `<img src="/img/<name>-<size>.webp" alt="…">` in `html`, judged against `shots`. */
  const mismatched = (html: string, shots: Shot[]) => [...html.matchAll(/<img\s[^>]*?src="\/img\/([a-z-]+?)-(?:phone|desktop)\.webp"[^>]*?alt="([^"]*)"/gs)].flatMap(m => {
    const shot = shots.find(s => s.name === m[1]);
    if (!shot?.year) return [];
    const want = YEARS.find(y => y.id === shot.year)!.title;
    // "Year 1" must not be read inside "Year 10": match the title as a whole word
    const named = titles.filter(t => new RegExp(`\\b${t}\\b`).test(m[2]));
    return named.length === 1 && named[0] === want ? [] : [`${m[1]}: alt names [${named.join(', ')}], the shot is ${want}`];
  });
  it('gives every shot with a topic a year, and a topic that exists in it', () => {
    for (const s of SHOTS as Shot[]) {
      if (!s.topic) continue;
      expect(YEARS.some(y => y.id === s.year), `${s.name} year`).toBe(true);
      expect(topicById(s.topic)?.year, `${s.name} topic ${s.topic}`).toBe(s.year);
    }
  });
  it('has each shot with a year read its year and topic in run', () => {
    const src = readFileSync(root + 'scripts/site-shots.mjs', 'utf8');
    expect(src).toContain('await shot.run(page, shot)');
    for (const s of SHOTS as Shot[]) {
      if (s.year) expect(s.name, 'run must take the shot').toSatisfy((n: string) => (SHOTS.find(x => x.name === n)!.run as unknown as { length: number }).length === 2);
    }
    expect(src).not.toMatch(/openTopic\(page, '/);
    expect(src).not.toMatch(/data-year="year/);
  });
  it('flags a wrong year, an unnamed year and two years, and passes the right one (fixture)', () => {
    const shots: Shot[] = [{ name: 'slice', year: 'year1', topic: 'y1-add' }, { name: 'sky-map' }];
    const img = (name: string, alt: string) => `<img src="/img/${name}-phone.webp" width="390"\n alt="${alt}">`;
    expect(mismatched(img('slice', 'A Year 1 adding question'), shots)).toEqual([]);
    expect(mismatched(img('slice', 'A Year 2 adding question'), shots)).toHaveLength(1);
    expect(mismatched(img('slice', 'An adding question'), shots)).toHaveLength(1);
    expect(mismatched(img('slice', 'Year 1 and Year 2 questions'), shots)).toHaveLength(1);
    expect(mismatched(img('sky-map', 'One island per year'), shots)).toEqual([]);
  });
  it('holds every guide picture of a shot with a year to that year', () => {
    const guides = pages('website/guides').filter(p => p.endsWith('.html'));
    expect(guides.length, 'the guides it reads').toBeGreaterThan(0);
    expect(guides.flatMap(p => mismatched(readFileSync(p, 'utf8'), SHOTS as Shot[]).map(e => `${p.replace(root, '')} ${e}`))).toEqual([]);
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { stripHead } from '../../scripts/bundle-single.mjs';
import { listFiles, precacheList } from '../../scripts/build-sw.mjs';
import { checkedBytes, ICONS, iconPage, imageSize, SAFE } from '../../scripts/pwa-icons.mjs';
import { appleIconHref, DANGLING_ICON } from './helpers/icons';

/**
 * The icon generator and the icon rails that match structure, not spelling (#630, #631, #632). The icon files
 * themselves are checked against the manifest in pwa.test.ts; this file is the script and the precache.
 */
const manifest = JSON.parse(readFileSync(new URL('../../public/manifest.webmanifest', import.meta.url), 'utf8'));
const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const inset = (page: string) => Number(page.match(/inset:([\d.]+)%/)![1]);

describe('scripts/pwa-icons.mjs is exercised (#630)', () => {
  it('a maskable icon insets the art by exactly (1 - SAFE) / 2, an `any` icon by 0', () => {
    expect(inset(iconPage('x', 512, true))).toBeCloseTo(((1 - SAFE) / 2) * 100, 10);
    expect(inset(iconPage('x', 512, false))).toBe(0);
  });

  it('the maskable safe zone is no wider than the 80% the platforms guarantee', () => {
    expect(SAFE).toBeLessThanOrEqual(0.8);
  });

  it('ICONS is the manifest, by file, size and purpose — the rail the ICONS comment claims', () => {
    const fromManifest = manifest.icons.map((i: { src: string; sizes: string; purpose: string }) =>
      `${i.src.replace(/^icons\//, '')} ${i.sizes} ${i.purpose}`);
    const fromScript = ICONS.filter(i => i.file !== 'apple-touch-icon.png')
      .map(i => `${i.file} ${i.size}x${i.size} ${i.maskable ? 'maskable' : 'any'}`);
    expect(fromScript.sort()).toEqual(fromManifest.sort());
    // The Apple icon is not in the manifest (Safari reads the <link>), but the generator must still draw it.
    expect(ICONS.find(i => i.file === appleIconHref(html)?.replace(/^icons\//, ''))?.size).toBe(180);
  });

  it('the generator refuses bytes that are not the size it reports', () => {
    const png = (n: number) => { const b = Buffer.alloc(24); b.write('\x89PNG', 0, 'latin1'); b.writeUInt32BE(n, 16); b.writeUInt32BE(n, 20); return b; };
    expect(checkedBytes('a.png', 180, png(180))).toHaveLength(24);
    // `deviceScaleFactor: 2` made 180 into 360 and the log still said 180.
    expect(() => checkedBytes('a.png', 180, png(360))).toThrow(/expected 180x180.*produced 360x360/);
    expect(() => checkedBytes('a.webp', 180, png(180)), 'a PNG wearing a .webp name').toThrow(/image\/webp/);
  });
});

describe('imageSize reads every form the encoder can emit (#631)', () => {
  const riff = (fourcc: string) => { const b = Buffer.alloc(40); b.write('RIFF', 0); b.write('WEBP', 8); b.write(fourcc, 12, 'latin1'); return b; };
  it('VP8X (alpha), lossy VP8 and lossless VP8L all give the real canvas size', () => {
    const x = riff('VP8X'); x.writeUIntLE(191, 24, 3); x.writeUIntLE(191, 27, 3);
    expect(imageSize(x)).toEqual({ w: 192, h: 192, kind: 'image/webp' });
    const lossy = riff('VP8 '); lossy.writeUInt16LE(512, 26); lossy.writeUInt16LE(512, 28);
    expect(imageSize(lossy)).toEqual({ w: 512, h: 512, kind: 'image/webp' });
    const lossless = riff('VP8L'); lossless.writeUInt32LE(511 | (511 << 14), 21);
    expect(imageSize(lossless)).toEqual({ w: 512, h: 512, kind: 'image/webp' });
  });
});

describe('the Apple icon rails match the tag, not one spelling of it (#631)', () => {
  const head = (link: string) => `<title>t</title>\n${link}\n<meta name="theme-color" content="#131a33" />`;

  it('a root-absolute href that the bundler failed to strip is caught', () => {
    const left = head('<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />');
    expect(left, 'with the strip dropped, the old `icons/` pattern saw nothing').not.toMatch(/(?:href|src)="icons\//);
    expect(left).toMatch(DANGLING_ICON);
    expect(head('<img src="/icons/a.png">')).toMatch(DANGLING_ICON);
  });

  it('a correct page stays green however the link is spelt', () => {
    for (const link of [
      '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png" />',
      '<link rel="apple-touch-icon" sizes="180x180" href="icons/apple-touch-icon.png" />',
    ]) {
      expect(appleIconHref(link), link).toBe('icons/apple-touch-icon.png');
      expect(stripHead(head(link)), `${link} is stripped from the single-file page`).not.toMatch(DANGLING_ICON);
    }
    expect(appleIconHref('<link href="icons/a.png" rel="apple-touch-icon">'), 'attribute order').toBe('icons/a.png');
    expect(stripHead(head('<link rel="icon" href="data:image/svg+xml,x" />'))).not.toMatch(DANGLING_ICON);
  });

  it('every icon `src` and the Apple href are relative, as start_url, scope and id are', () => {
    const srcs = [...manifest.icons.map((i: { src: string }) => i.src), appleIconHref(html) ?? ''];
    expect(srcs).toHaveLength(manifest.icons.length + 1);
    for (const src of srcs) expect(src, 'a root-absolute icon claims another app\'s path on a sub-path deployment').toMatch(/^(?!\/|[a-z]+:)/);
  });
});

describe('what the service worker precaches of public/icons/ (#632)', () => {
  // `public/` is copied to the root of `dist/` unchanged, so listing it stands for the part of the build
  // the precache sweeps up from there.
  const list = precacheList(listFiles(new URL('../../public', import.meta.url).pathname));

  it('the manifest icons are precached', () => {
    for (const i of manifest.icons) expect(list, i.src).toContain(i.src);
  });

  it('apple-touch-icon.png is not: iOS fetches it itself, and a 404 on it must not fail the install', () => {
    expect(list).not.toContain('icons/apple-touch-icon.png');
    expect(precacheList(['icons/apple-touch-icon.png', 'index.html'])).toEqual(['index.html']);
  });
});

import { test, expect } from './fixtures';

/**
 * #629 (#139 findings 1 and 2). The unit rails in `tests/unit/pwa.test.ts` read headers, never a pixel, so two
 * mistakes shipped green: a `maskable` icon that is really an `any` crop (the platform cuts the ninja's head
 * off), and an icon truncated after its header (the declared size survives, Chromium cannot decode it).
 * This spec decodes every icon the manifest declares, through the preview server, in a real browser.
 *
 * The discriminator is the share of the outer 10% ring that departs from the background colour `GROUND`
 * (`#131a33`), measured in the issue: any icons 18-19%, maskable-512 0.00%. The thresholds sit far from both.
 * The unit rail on `SAFE <= 0.8` (tests/unit/pwa-icons.test.ts) is the generator-side half; this is the pixels.
 *
 * Prove it red: swap the `purpose` of two icons in public/manifest.webmanifest, point the maskable `src` at an
 * `any` file, or truncate an icon to its first 30 bytes, then `npm run build` and run this file.
 */
const GROUND: [number, number, number] = [0x13, 0x1a, 0x33];

interface Probe { src: string; purpose: string; sizes: string; w: number; h: number; ring: number }

test('every manifest icon decodes at its declared size, and only the maskable one keeps its ring empty (#629)', async ({ page }) => {
  await page.goto('/');
  const probes = await page.evaluate(async (ground): Promise<Probe[]> => {
    const manifestUrl = new URL(document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!.href, location.href);
    const manifest = await (await fetch(manifestUrl)).json();
    const out: Probe[] = [];
    for (const icon of manifest.icons) {
      const url = new URL(icon.src, manifestUrl);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${icon.src}: HTTP ${res.status}`);
      const bmp = await createImageBitmap(await res.blob()).catch((e: Error) => {
        throw new Error(`${icon.src} could not be decoded (truncated or corrupt?): ${e.message}`);
      });
      const canvas = document.createElement('canvas');
      canvas.width = bmp.width; canvas.height = bmp.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bmp, 0, 0);
      const { data } = ctx.getImageData(0, 0, bmp.width, bmp.height);
      const edge = Math.round(bmp.width * 0.1);
      let ring = 0, off = 0;
      for (let y = 0; y < bmp.height; y++) for (let x = 0; x < bmp.width; x++) {
        if (x >= edge && x < bmp.width - edge && y >= edge && y < bmp.height - edge) continue;
        ring++;
        const i = (y * bmp.width + x) * 4;
        // Lossy WebP drifts a few levels; a transparent pixel is "departing" too (alpha < 255).
        if (data[i + 3] < 255 || Math.max(Math.abs(data[i] - ground[0]), Math.abs(data[i + 1] - ground[1]), Math.abs(data[i + 2] - ground[2])) > 24) off++;
      }
      out.push({ src: icon.src, purpose: icon.purpose, sizes: icon.sizes, w: bmp.width, h: bmp.height, ring: (off / ring) * 100 });
    }
    return out;
  }, GROUND);

  expect(probes.length, 'the manifest declares no icons').toBeGreaterThanOrEqual(3);
  for (const p of probes) expect(`${p.w}x${p.h}`, `${p.src} decodes at a different size than the manifest declares`).toBe(p.sizes);
  const maskable = probes.filter(p => p.purpose === 'maskable');
  const any = probes.filter(p => p.purpose === 'any');
  expect(maskable.length, 'no maskable icon declared').toBeGreaterThan(0);
  for (const p of maskable) expect(p.ring, `${p.src} is declared maskable but its outer 10% ring is ${p.ring.toFixed(2)}% art: the platform crops the ninja`).toBeLessThan(2);
  for (const p of any) expect(p.ring, `${p.src} is declared any but its outer 10% ring is ${p.ring.toFixed(2)}% art: a small ninja adrift in a square`).toBeGreaterThan(5);
});

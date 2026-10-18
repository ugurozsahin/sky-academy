import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Rail for #1937 (policy: #1926). The game is a children's service: Apple's Kids Category bans third-party
// analytics and ads, Google Play Families limits ads to certified SDKs, the ICO Children's Code wants profiling
// off. Nothing tracks today, but #1926 adds GTM to the promotional pages from the same deploy, and a shared
// include could put it in the game with every test green. So: the BUILT game must reach no tracking domain or
// SDK, and package.json must hold no analytics or ads package. (A sibling file because guardrails.test.ts is
// frozen at its length, #1388.) Promotional pages are out of scope: they are not part of this build.
const TRACKING: [string, RegExp][] = [
  ['googletagmanager.com', /googletagmanager\.com/i],
  ['google-analytics.com', /google-analytics\.com/i],
  ['gtag(', /\bgtag\s*\(/],
  ['doubleclick', /doubleclick/i],
  ['firebase', /firebase/i],
  ['facebook.net', /facebook\.net/i],
  ['adservice', /adservice/i],
];
const BAD_PACKAGE = /analytics|gtag|googletagmanager|firebase|sentry|mixpanel|amplitude|posthog|hotjar|segment|appsflyer|adjust|adsense|admob|google-mobile-ads|facebook|fbq|doubleclick|react-ga|\bads?\b|-ads$|^ads-/i;

const trackingHits = (files: Record<string, string>) =>
  Object.entries(files).flatMap(([path, text]) => TRACKING.filter(([, re]) => re.test(text)).map(([name]) => `${path}: ${name}`));
const badPackages = (pkg: { dependencies?: object; devDependencies?: object }) =>
  Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter(n => BAD_PACKAGE.test(n));

const TEXT = /\.(html|js|mjs|css|json|webmanifest|txt|xml|svg)$/;
const readAll = (dir: string, base = dir): Record<string, string> => Object.fromEntries(readdirSync(dir).flatMap(f => {
  const p = join(dir, f);
  if (statSync(p).isDirectory()) return Object.entries(readAll(p, base));
  return TEXT.test(f) ? [[p.slice(base.length + 1), readFileSync(p, 'utf8')] as [string, string]] : [];
}));

describe('the game build holds no tracking, analytics or ads code (#1937)', () => {
  let out = '';
  let built: Record<string, string> = {};
  // Built into a temp folder, never `dist/` (shared with the e2e preview, #136).
  beforeAll(() => {
    out = mkdtempSync(join(tmpdir(), 'sna-notrack-'));
    execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'], { stdio: 'pipe' });
    built = readAll(out);
  }, 120_000);
  afterAll(() => { if (out) rmSync(out, { recursive: true, force: true }); });

  it('scans a real build: index.html and a script chunk are among the files read', () => {
    expect(Object.keys(built)).toContain('index.html');
    expect(Object.keys(built).some(f => f.endsWith('.js'))).toBe(true);
  });

  it('the built game reaches no tracking domain or SDK', () => {
    expect(trackingHits(built)).toEqual([]);
  });

  it('goes red on a build whose index.html carries a gtag snippet', () => {
    const snippet = '<script async src="https://www.googletagmanager.com/gtag/js?id=G-X"></script><script>gtag("config","G-X")</script>';
    const dirty = built['index.html'].replace('</head>', `${snippet}</head>`);
    expect(dirty, 'the fixture must actually inject').not.toBe(built['index.html']);
    // written into the build folder and read back from disk, exactly as the real scan reads it
    writeFileSync(join(out, 'index.html'), dirty);
    expect(trackingHits(readAll(out))).toEqual(['index.html: googletagmanager.com', 'index.html: gtag(']);
  });

  it('each banned domain or SDK is detected on its own', () => {
    for (const [name, probe] of [['googletagmanager.com', 'https://www.googletagmanager.com/gtm.js'], ['google-analytics.com', 'https://www.google-analytics.com/a.js'], ['gtag(', 'gtag("js",1)'], ['doubleclick', 'https://stats.g.doubleclick.net'], ['firebase', 'import "firebase/analytics"'], ['facebook.net', 'connect.facebook.net/en_US/fbevents.js'], ['adservice', 'https://adservice.google.com']]) {
      expect(trackingHits({ 'x.js': probe }), name).toEqual([`x.js: ${name}`]);
    }
  });

  it('package.json holds no analytics or ads package', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(Object.keys(pkg.dependencies ?? {}).length, 'the check must read real dependencies').toBeGreaterThan(0);
    expect(badPackages(pkg)).toEqual([]);
  });

  it('the package check goes red on an analytics or ads package', () => {
    expect(badPackages({ dependencies: { firebase: '1' }, devDependencies: { '@sentry/browser': '1', 'react-ga4': '1', '@capacitor-community/admob': '1', vitest: '3' } }).sort())
      .toEqual(['@capacitor-community/admob', '@sentry/browser', 'firebase', 'react-ga4']);
  });
});

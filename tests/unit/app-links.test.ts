import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { assetlinks, packageOf } from '../../scripts/app-links.mjs';
import { isAppLink, wireNativeLinks } from '../../src/deeplink-native';

/** #2028: Android App Links. The manifest filter, the generated assetlinks.json and the native listener. */
const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const config = read('capacitor.config.ts');
const FP = Array.from({ length: 32 }, (_, i) => i.toString(16).padStart(2, '0').toUpperCase()).join(':');

describe('AndroidManifest App Links filter (#2028)', () => {
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  const filter = manifest.split('<intent-filter').find(f => f.includes('autoVerify')) ?? '';
  it('MainActivity has one verified VIEW filter for https://sharpwise.co.uk/play', () => {
    expect(filter).toContain('android:autoVerify="true"');
    expect(filter).toContain('"android.intent.action.VIEW"');
    expect(filter).toContain('"android.intent.category.DEFAULT"');
    expect(filter).toContain('"android.intent.category.BROWSABLE"');
    expect(filter).toContain('<data android:scheme="https" android:host="sharpwise.co.uk" android:pathPrefix="/play" />');
    expect(manifest.match(/autoVerify/g)).toHaveLength(1);
    expect(manifest.indexOf('autoVerify')).toBeLessThan(manifest.indexOf('</activity>'));
  });
  it('declares no custom scheme', () => {
    expect([...manifest.matchAll(/android:scheme="([^"]+)"/g)].map(m => m[1])).toEqual(['https']);
  });
});

describe('assetlinks.json generation (#2028)', () => {
  it('reads the package from capacitor.config.ts', () => {
    expect(packageOf(config)).toBe('uk.co.sharpwise');
  });
  it('builds valid handle_all_urls JSON for the package and fingerprint', () => {
    const doc = JSON.parse(JSON.stringify(assetlinks(packageOf(config), ` ${FP.toLowerCase()} `)));
    expect(doc).toEqual([{
      relation: ['delegate_permission/common.handle_all_urls'],
      target: { namespace: 'android_app', package_name: packageOf(config), sha256_cert_fingerprints: [FP] },
    }]);
  });
  it('accepts several fingerprints, comma or space separated', () => {
    const two = assetlinks('uk.co.sharpwise', `${FP}, ${FP.replace('00:', '11:')}`) as { target: { sha256_cert_fingerprints: string[] } }[];
    expect(two[0].target.sha256_cert_fingerprints).toHaveLength(2);
  });
  it('ships no file when the variable is unset or blank, and refuses a malformed fingerprint', () => {
    expect(assetlinks('uk.co.sharpwise', undefined)).toBeNull();
    expect(assetlinks('uk.co.sharpwise', '  ')).toBeNull();
    expect(() => assetlinks('uk.co.sharpwise', 'abc')).toThrow(/SHA-256/);
    expect(() => assetlinks('uk.co.sharpwise', FP.slice(3))).toThrow(/SHA-256/);
  });
  it('the manifest, the config and the Pages workflow agree', () => {
    expect(read('android/app/src/main/AndroidManifest.xml')).not.toContain('package=');   // the id is the Gradle applicationId
    expect(read('android/app/build.gradle')).toContain(`applicationId "${packageOf(config)}"`);
    const wf = read('.github/workflows/pages.yml');
    expect(wf).toContain('node scripts/app-links.mjs site');
    expect(wf).toContain('ANDROID_APP_LINKS_SHA256: ${{ vars.ANDROID_APP_LINKS_SHA256 }}');
    expect(wf).toMatch(/^    if: vars\.PAGES_ENABLED == 'true'/m);
  });
});

describe('isAppLink (#2028)', () => {
  it.each([
    ['https://sharpwise.co.uk/play/?topic=y1-bonds', true],
    ['https://sharpwise.co.uk/play', true],
    ['https://sharpwise.co.uk/', false],
    ['https://sharpwise.co.uk/playground/', false],
    ['https://sharpwise.co.uk.evil.example/play/', false],
    ['https://evil.example/play/?topic=y1-bonds', false],
    ['https://user@sharpwise.co.uk/play/', false],
    ['http://sharpwise.co.uk/play/', false],
    ['javascript:alert(1)//sharpwise.co.uk/play/', false],
    ['not a url', false],
  ])('%s -> %s', (url, ok) => expect(isAppLink(url)).toBe(ok));
  it('rejects a non-string', () => { expect(isAppLink(undefined)).toBe(false); expect(isAppLink({})).toBe(false); });
});

describe('wireNativeLinks (#2028)', () => {
  const setup = (launch: unknown = undefined, present = true) => {
    let fire: (e: { url?: unknown }) => void = () => {};
    const addListener = vi.fn((_: string, cb: (e: { url?: unknown }) => void) => { fire = cb; });
    const App = { addListener, getLaunchUrl: vi.fn(async () => launch) };
    const bridge = { Capacitor: { isNativePlatform: () => true, Plugins: present ? { App } : {} } } as unknown as Window & typeof globalThis;
    const open = vi.fn();
    wireNativeLinks({ open, bridge });
    return { open, addListener, App, fire: (url: unknown) => fire({ url }) };
  };
  it('opens a good link, ignores an unknown path, a foreign host and a javascript: URL', () => {
    const t = setup();
    expect(t.addListener).toHaveBeenCalledWith('appUrlOpen', expect.any(Function));
    t.fire('https://sharpwise.co.uk/play/?topic=y1-bonds');
    t.fire('https://sharpwise.co.uk/about');
    t.fire('https://evil.example/play/?topic=y1-bonds');
    t.fire('javascript:alert(1)');
    t.fire(undefined);
    expect(t.open.mock.calls).toEqual([['https://sharpwise.co.uk/play/?topic=y1-bonds']]);
  });
  it('a cold start opens the launch URL when it is ours, and nothing otherwise', async () => {
    const good = setup({ url: 'https://sharpwise.co.uk/play/?year=y1' });
    await Promise.resolve(); await Promise.resolve();
    expect(good.open).toHaveBeenCalledWith('https://sharpwise.co.uk/play/?year=y1');
    const foreign = setup({ url: 'https://evil.example/play/' });
    await Promise.resolve(); await Promise.resolve();
    expect(foreign.open).not.toHaveBeenCalled();
    const none = setup(undefined);
    await Promise.resolve(); await Promise.resolve();
    expect(none.open).not.toHaveBeenCalled();
  });
  it('does nothing in a browser or without the App plugin', () => {
    const open = vi.fn();
    wireNativeLinks({ open, bridge: {} as Window & typeof globalThis });
    wireNativeLinks({ open, bridge: { Capacitor: { isNativePlatform: () => true, Plugins: {} } } as unknown as Window & typeof globalThis });
    const t = setup(undefined, false);
    expect(t.addListener).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });
  it('src/main.ts wires it, and nothing imports @capacitor/app (the web build never loads the plugin)', () => {
    expect(read('src/main.ts')).toContain('wireNativeLinks({ open: handleDeepLink })');
    expect(read('src/deeplink-native.ts')).not.toMatch(/from '@capacitor\//);
  });
});

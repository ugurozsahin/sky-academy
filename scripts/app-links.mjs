// #2028: builds site/.well-known/assetlinks.json for Android App Links. The package comes from capacitor.config.ts;
// the fingerprints from the repository variable ANDROID_APP_LINKS_SHA256 (comma or space separated). Unset: no file.
// A file without a real fingerprint verifies nothing, so we publish none and links open in the browser (docs/ANDROID.md).
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

export function packageOf(configText) {
  const m = /appId:\s*'([^']+)'/.exec(configText);
  if (!m) throw new Error('capacitor.config.ts: no appId');
  return m[1];
}

/** The assetlinks document, or null when no fingerprint was supplied. Throws on a malformed one. */
export function assetlinks(pkg, raw) {
  const prints = String(raw ?? '').split(/[\s,]+/).filter(Boolean).map(s => s.toUpperCase());
  if (!prints.length) return null;
  const bad = prints.find(p => !FINGERPRINT.test(p));
  if (bad) throw new Error(`ANDROID_APP_LINKS_SHA256: not a SHA-256 fingerprint (32 colon-separated hex bytes): ${bad}`);
  return [{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: { namespace: 'android_app', package_name: pkg, sha256_cert_fingerprints: prints },
  }];
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const site = process.argv[2] ?? 'site';
  const pkg = packageOf(readFileSync(new URL('../capacitor.config.ts', import.meta.url), 'utf8'));
  const doc = assetlinks(pkg, process.env.ANDROID_APP_LINKS_SHA256);
  if (!doc) console.log('ANDROID_APP_LINKS_SHA256 unset: no assetlinks.json (links open in the browser)');
  else {
    mkdirSync(`${site}/.well-known`, { recursive: true });
    writeFileSync(`${site}/.well-known/assetlinks.json`, JSON.stringify(doc, null, 2) + '\n');
    console.log(`wrote ${site}/.well-known/assetlinks.json for ${pkg}`);
  }
}

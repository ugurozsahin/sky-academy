// #2029: after a Pages deploy, fetch the app-association files the way the OS does and fail if one is wrong.
// Usage: node scripts/check-well-known.mjs <base-url> [--ios]   (e.g. https://sharpwise.co.uk; a local server works too)
// Both platforms silently ignore a file that is redirected, missing or served with the wrong type, and the only
// symptom is "the link opens the browser". Exit 0 = all as expected, 1 = a check failed, 2 = bad usage.
//
// Which files are EXPECTED comes from the same decision the generator makes: Android's assetlinks.json exists exactly
// when scripts/app-links.mjs would write it (ANDROID_APP_LINKS_SHA256 holds a fingerprint). The iOS file has no
// generator yet (#2030), so it is expected only with --ios; #2030 should replace that flag with its own decision.
// An intentionally absent file must answer 404 (not a failure); an unexpectedly absent one, or an unexpected 200, fails.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { assetlinks, packageOf } from './app-links.mjs';

export const FILES = ['.well-known/assetlinks.json', '.well-known/apple-app-site-association'];

/** Which of FILES the deploy should publish. `androidRaw` is the ANDROID_APP_LINKS_SHA256 value. */
export function expectedFiles(pkg, androidRaw, ios) {
  return { [FILES[0]]: assetlinks(pkg, androidRaw) !== null, [FILES[1]]: !!ios };
}

/** Problems with one file: a list of messages, empty when it is as it should be. */
export async function checkFile(base, path, expected) {
  const url = `${base.replace(/\/+$/, '')}/${path}`;
  let res;
  try { res = await fetch(url, { redirect: 'manual' }); } catch (e) { return [`${url}: request failed (${e.cause?.code ?? e.message})`]; }
  const { status } = res;
  if (!expected) return status === 404 ? [] : [`${url}: not expected (nothing generates it) but answered ${status}; want 404`];
  if (status >= 300 && status < 400) return [`${url}: redirected (${status} to ${res.headers.get('location')}); platforms refuse a redirected file`];
  if (status !== 200) return [`${url}: status ${status}, want 200 (was the file left out of the deploy?)`];
  const problems = [];
  const type = res.headers.get('content-type') ?? '';
  if (!/^application\/json\s*(;|$)/i.test(type)) problems.push(`${url}: content-type "${type}", want application/json`);
  try { JSON.parse(await res.text()); } catch { problems.push(`${url}: body is not JSON`); }
  return problems;
}

export async function checkAll(base, expected) {
  const out = [];
  for (const f of FILES) out.push(...await checkFile(base, f, expected[f]));
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const base = args.find(a => !a.startsWith('--'));
  if (!base || !/^https?:\/\//.test(base)) { console.error('usage: node scripts/check-well-known.mjs <https://host> [--ios]'); process.exit(2); }
  const pkg = packageOf(readFileSync(new URL('../capacitor.config.ts', import.meta.url), 'utf8'));
  const expected = expectedFiles(pkg, process.env.ANDROID_APP_LINKS_SHA256, args.includes('--ios'));
  const problems = await checkAll(base, expected);
  for (const f of FILES) console.log(`${expected[f] ? 'expect file  ' : 'expect absent'} ${f}`);
  if (problems.length) { for (const p of problems) console.error(`FAIL ${p}`); process.exit(1); }
  console.log('ok: the .well-known files are as the deploy intended');
}

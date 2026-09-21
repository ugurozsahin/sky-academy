// Generates `dist/sw.js` from `scripts/sw-template.js` after `vite build` (#15 Part A).
//
// The precache list is READ FROM THE BUILD, never written down. Vite hashes every asset filename, so a
// hand-maintained list is wrong the moment anything changes and the failure is the worst shape there is: the
// service worker installs happily, then serves a cached `index.html` that asks for `index-OLD.js`, which is
// not in the cache and — offline — not anywhere. A blank sky that clearing the cache is the only cure for.
//
// Usage: node scripts/build-sw.mjs [distDir]
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Files that must never be precached, whatever is in `dist/`. */
const EXCLUDE = new Set(['sw.js']);

/**
 * Every file under `dir`, as forward-slashed paths relative to it, sorted. Sorted because the cache name is
 * derived from this list: two builds of identical output must produce the same name, or every deployment
 * would look new and throw away a cache that was still correct.
 */
export function listFiles(dir, readdir = readdirSync) {
  const walk = (sub) => readdir(join(dir, sub), { withFileTypes: true }).flatMap(e => {
    const rel = sub ? `${sub}/${e.name}` : e.name;
    return e.isDirectory() ? walk(rel) : [rel];
  });
  return walk('').sort();
}

/** The precache list: everything the build emitted, minus the worker itself. */
export function precacheList(files) {
  return files.filter(f => !EXCLUDE.has(f)).sort();
}

/**
 * One line per precached file: `name\0size\0sha256`. The cache name is derived from THIS, not from the
 * filenames, and that distinction is the whole point.
 *
 * Only two of the twenty-three precached files are content-hashed by Vite. The other twenty-one —
 * `index.html`, `manifest.webmanifest`, two self-hosted Fredoka `.woff2`s and their licence (#479), and
 * twelve avatar `.webp`s — keep their names when their contents change, and the
 * avatars are the owner's art, the single most likely thing in this repository to be re-exported in place.
 * Hashing filenames would give a re-exported `blaze.webp` an identical cache name, so `activate` would keep
 * the old cache, and `asset()` is cache-first with no revalidation: every returning player would see the old
 * picture for ever. (Raised in review of this PR.)
 */
export function fingerprints(dir, list, read = readFileSync) {
  return list.map(f => {
    const bytes = read(join(dir, f));
    return `${f}\0${bytes.length}\0${createHash('sha256').update(bytes).digest('hex')}`;
  });
}

/** Deterministic, short, and different whenever any precached file differs in name, size or contents. */
export function cacheName(prints) {
  return `sna-${createHash('sha256').update(prints.join('\n')).digest('hex').slice(0, 12)}`;
}

/** Substitutes both placeholders. Throws if either is missing, so a renamed placeholder cannot ship a worker
 *  that precaches the literal string `__PRECACHE__`.
 *
 *  `prints` is required, not defaulted to `list` (#116 item 3): both parameters are `string[]`, so a default
 *  of `prints = list` let a caller forget the third argument entirely — or transpose it as
 *  `renderSw(t, prints, list)` — and still type-check and run, naming every cache after filenames instead of
 *  content. Twenty-one of the twenty-three precached files are not content-hashed by Vite (the twelve avatars most
 *  of all), so that bug ships the old picture for ever: `activate` keeps the old cache, and `asset()` is
 *  cache-first with no revalidation. The guard below only checks *shape* (a fingerprint always contains the
 *  `\0` `fingerprints()` joins with; a bare filename never does) — it cannot tell a correct fingerprint from
 *  a stale one, only a fingerprint from a filename. */
export function renderSw(template, list, prints) {
  if (!Array.isArray(prints) || prints.some(p => !p.includes('\0'))) {
    throw new Error('renderSw: prints must be fingerprints ("name\\0size\\0hash"), not filenames — pass the ' +
      'output of fingerprints(), not list again');
  }
  for (const token of ['__CACHE_NAME__', '__PRECACHE__']) {
    // Exactly one, not merely present: `String.replace` with a string needle takes the first occurrence, so
    // a second copy of a placeholder would ship un-substituted inside the worker. (Raised in review.)
    const n = template.split(token).length - 1;
    if (n !== 1) throw new Error(`scripts/sw-template.js contains ${token} ${n} times, expected exactly 1`);
  }
  return template
    .replace('__CACHE_NAME__', cacheName(prints))
    .replace('__PRECACHE__', JSON.stringify(list, null, 2));
}

// `resolve(argv[1]) === fileURLToPath(import.meta.url)` compares two filesystem paths, not a raw path against
// a percent-encoded URL (#116): the old `` `file://${process.argv[1]}` `` broke on any character `file://`
// URLs escape — a space, `#`, anything non-ASCII — so a checkout under a path like `~/Documents/Sky Academy/…`
// made this whole block silently skip, and `npm run build` exited 0 with no `sw.js` and no error anywhere.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = process.argv[2] ?? 'dist';
  if (!existsSync(join(dist, 'index.html'))) throw new Error(`${dist}/index.html is missing — run vite build first`);
  const list = precacheList(listFiles(dist));
  if (!list.includes('index.html')) throw new Error('the precache list has no index.html');
  if (!list.some(f => f.endsWith('.js'))) throw new Error('the precache list has no JavaScript — the build is empty');
  const prints = fingerprints(dist, list);
  writeFileSync(join(dist, 'sw.js'), renderSw(readFileSync('scripts/sw-template.js', 'utf8'), list, prints));
  console.log(`wrote ${dist}/sw.js — ${list.length} files precached as ${cacheName(prints)}`);
}

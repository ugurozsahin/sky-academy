// Builds dist/ then inlines JS, CSS and avatar images into one self-contained HTML (for hosting as a single page / Artifact).
// Usage: node scripts/bundle-single.mjs [out.html] [--artifact]  (--artifact = body-only fragment, no doctype/html/head/body)
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Everything in `<head>` that must not survive into the single-file page.
 *
 * Exported so `tests/unit/guardrails.test.ts` can assert on what it PRODUCES rather than on this file's
 * source text — a rail matching the source goes red on a harmless refactor and green if the regex quietly
 * stops matching the real `index.html`. (Raised in review of #214.)
 *
 * The manifest link is the one that matters beyond tidiness: `src/pwa.ts` reads it to decide whether to
 * register the service worker, and this page has no `sw.js` beside it wherever it ends up hosted, so leaving
 * it in would have the inlined app register a worker that cannot exist on an origin that is not ours (#15).
 */
export function stripHead(head) {
  return head
    .replace(/<script[^>]*><\/script>/g, '')
    .replace(/<link rel="stylesheet"[^>]*assets[^>]*>/g, '')
    .replace(/<link rel="manifest"[^>]*>/g, '')
    // #15 Part B: the Apple icon is a real file under `icons/`, and nothing ships beside the single page.
    // A dangling one is only a 404 rather than a fault, but it is a 404 asking somebody else's origin for a
    // picture of our ninja, and this function's job is that the page references nothing it has not inlined.
    .replace(/<link rel="apple-touch-icon"[^>]*>/g, '');
}

// Importing this file must not build anything: `tests/unit/guardrails.test.ts` imports `stripHead` to assert
// on its output, and a top-level `vite build` would run on every unit test run. Same guard as build-sw.mjs,
// fixed the same way for the same reason (#116): a raw filesystem path compared to a percent-encoded URL is
// false the moment the path needs escaping (a space, `#`, anything non-ASCII), and this block then silently
// no-ops — `node scripts/bundle-single.mjs` exits 0 from a path like `~/Documents/Sky Academy/…` with no
// `dist/sky-ninja-academy.html` written and no error.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = process.argv[2] ?? 'dist/sky-ninja-academy.html';
  const fragment = process.argv.includes('--artifact');
  execSync('npx vite build', { stdio: 'inherit' });
  const html = readFileSync('dist/index.html', 'utf8');
  const assets = readdirSync('dist/assets');
  let js = readFileSync(join('dist/assets', assets.find(f => f.endsWith('.js'))), 'utf8');
  const css = readFileSync(join('dist/assets', assets.find(f => f.endsWith('.css'))), 'utf8');
  for (const f of readdirSync('public/avatars')) {
    const b64 = readFileSync(join('public/avatars', f)).toString('base64');
    js = js.split(`avatars/${f}`).join(`data:image/webp;base64,${b64}`);
  }
  js = js.replace(/<\/script>/g, '<\\/script>');
  const head = stripHead(html.match(/<head>([\s\S]*?)<\/head>/)[1]);
  const body = `<div id="app"></div>\n<script type="module">${js}</script>`;
  const page = fragment
    ? `${head.replace(/<meta charset[^>]*>|<meta name="viewport"[^>]*>/g, '')}\n<style>${css}</style>\n${body}`
    : `<!doctype html>\n<html lang="en-GB">\n<head>${head}<style>${css}</style></head>\n<body>${body}</body>\n</html>`;
  writeFileSync(out, page);
  console.log(`wrote ${out} (${(page.length / 1024 / 1024).toFixed(2)} MB)`);
}

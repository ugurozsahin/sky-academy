// Builds dist/ then inlines JS, CSS and avatar images into one self-contained HTML (for hosting as a single page / Artifact).
// Usage: node scripts/bundle-single.mjs [out.html] [--artifact]  (--artifact = body-only fragment, no doctype/html/head/body)
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

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
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<script[^>]*><\/script>/g, '').replace(/<link rel="stylesheet"[^>]*assets[^>]*>/g, '');
const body = `<div id="app"></div>\n<script type="module">${js}</script>`;
const page = fragment
  ? `${head.replace(/<meta charset[^>]*>|<meta name="viewport"[^>]*>/g, '')}\n<style>${css}</style>\n${body}`
  : `<!doctype html>\n<html lang="en-GB">\n<head>${head}<style>${css}</style></head>\n<body>${body}</body>\n</html>`;
writeFileSync(out, page);
console.log(`wrote ${out} (${(page.length / 1024 / 1024).toFixed(2)} MB)`);

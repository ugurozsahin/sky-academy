// #715: one self-contained HTML page from an object's screenshots — every variant × tier in a grid, the 2-D
// avatar it belongs to beside them — for the session that made the object to publish as a Claude artifact,
// so the owner picks a variant on his phone (`three-art` skill §4). Images are inlined as data URLs: the page
// travels alone. Usage: node scripts/sketch-gallery.mjs <object> [--avatar <id>] [out.html]
// Default output: docs/sketchbook/<object>/gallery.html.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const esc = (s) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dataUrl = (file, type) => `data:${type};base64,${readFileSync(file).toString('base64')}`;

/** The `<variant>-<tier>.png` files under `dir`, grouped by variant, tiers in a stable order — as paths under `dir`. */
export function frames(dir, readdir = readdirSync) {
  const rows = new Map();
  for (const f of readdir(dir).filter(n => n.endsWith('.png')).sort()) {
    const m = /^(.+)-(low|high)\.png$/.exec(f);
    if (!m) continue;
    if (!rows.has(m[1])) rows.set(m[1], {});
    rows.get(m[1])[m[2]] = join(dir, f);
  }
  return rows;
}

export function galleryHtml({ object, rows, avatar, read = (f, t) => dataUrl(f, t) }) {
  const cell = (file) => file ? `<img src="${read(file, 'image/png')}" alt="">` : '<span class="none">—</span>';
  const body = [...rows].map(([variant, byTier]) => `
    <tr><th scope="row">${esc(variant)}</th><td>${cell(byTier.low)}</td><td>${cell(byTier.high)}</td></tr>`).join('');
  const beside = avatar ? `<figure><img src="${read(avatar, 'image/webp')}" alt=""><figcaption>the avatar it sits beside</figcaption></figure>` : '';
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(object)} — sketchbook gallery</title>
<style>
body{margin:0;padding:16px;background:#0d1226;color:#f4f6ff;font:16px/1.4 system-ui,sans-serif}
h1{font-size:20px;margin:0 0 12px}table{border-collapse:collapse;width:100%}th,td{padding:6px;text-align:center;vertical-align:top}
th{color:#9aa5cf;font-weight:600}img{max-width:100%;height:auto;border-radius:12px;background:#0d1226}
.none{color:#9aa5cf}figure{margin:16px 0 0;max-width:220px}figcaption{color:#9aa5cf;font-size:13px}
</style></head><body>
<h1>${esc(object)}</h1>
<table><thead><tr><th>variant</th><th>tablet (low)</th><th>good phone (high)</th></tr></thead><tbody>${body}
</tbody></table>${beside}
</body></html>`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const object = args.shift();
  if (!object) { console.error('usage: node scripts/sketch-gallery.mjs <object> [--avatar <id>] [out.html]'); process.exit(2); }
  const at = args.indexOf('--avatar');
  const avatarId = at >= 0 ? args.splice(at, 2)[1] : null;
  const dir = join('docs/sketchbook', object);
  if (!existsSync(dir)) { console.error(`${dir} is missing — run npm run sketch:shot first`); process.exit(1); }
  const rows = frames(dir);
  if (!rows.size) { console.error(`${dir} holds no <variant>-<tier>.png`); process.exit(1); }
  const avatar = avatarId ? join('public/avatars', `${avatarId}.webp`) : null;
  if (avatar && !existsSync(avatar)) { console.error(`${avatar} is missing`); process.exit(1); }
  const out = args[0] ?? join(dir, 'gallery.html');
  writeFileSync(out, galleryHtml({ object, rows, avatar }));
  console.log(`wrote ${out} — ${rows.size} variants`);
}

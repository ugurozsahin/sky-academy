import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'fs';
const src = readFileSync('src/avatars.ts','utf8');
// quick transpile: strip TS types via esbuild (bundled with vite)
import { transformSync } from 'esbuild';
const js = transformSync(src, { loader: 'ts', format: 'esm' }).code;
writeFileSync('/tmp/avatars.mjs', js);
const m = await import('/tmp/avatars.mjs');
const cards = m.AVATARS.map(a => `<div class="card"><div class="row">${m.avatarSVG(a,'idle',150)}${m.avatarSVG(a,'happy',150)}</div><h3>${a.name}</h3><p>${a.element} Ninja</p><p class="q">“${a.praise[0].replace('{name}','Ada')}”</p></div>`).join('');
const html = `<html><body style="margin:0;background:linear-gradient(160deg,#1b2a4a,#0e1730);font-family:system-ui;padding:24px"><h1 style="margin:0 0 16px;color:#fff">Sky Ninja Academy — avatar set (idle / happy)</h1><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">${cards}</div><style>.card{background:linear-gradient(#1c2440,#0f1428);color:#fff;border-radius:20px;padding:12px;text-align:center;box-shadow:0 6px 20px rgba(0,0,0,.1)}.row{display:flex;justify-content:center;gap:8px}h3{margin:6px 0 0}p{margin:2px 0;color:#aab}.q{font-style:italic;color:#2f7fd9}</style></body></html>`;
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}); const p = await b.newPage({viewport:{width:1400,height:1100}});
await p.setContent(html); await p.screenshot({path:'/mnt/user-data/outputs/avatars-preview.png', fullPage:true}); await b.close();

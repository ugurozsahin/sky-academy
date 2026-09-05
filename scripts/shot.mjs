// Usage: node scripts/shot.mjs <url> <out.png> [w] [h] [script-file]
import { chromium } from '@playwright/test';
const [url, out, w = '390', h = '844', script] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, hasTouch: true, isMobile: +w < 700 });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('PAGE ERROR:', e.message)); p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE:', m.text()); });
await p.goto(url, { waitUntil: 'networkidle' });
if (script) { const { default: run } = await import(process.cwd() + '/' + script); await run(p); }
await p.waitForTimeout(400);
await p.screenshot({ path: out }); await b.close();

import { chromium } from '@playwright/test';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await p.goto('http://localhost:4173/?reset=1'); await p.click('.avatar-card[data-id="volt"]'); await p.click('#go');
await p.click('.island[data-year="reception"]'); await p.click('.topic[data-id="r-onemore"]');
for (let t = 0; t < 16; t += 1) { await p.waitForTimeout(1000); console.log(t, JSON.stringify(await p.evaluate(() => ({ n: window.__sna.bubbles().map(b => b.label + '@' + Math.round(b.y)), st: window.__sna.state() })))); }
await b.close();

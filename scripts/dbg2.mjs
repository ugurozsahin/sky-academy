import { chromium } from '@playwright/test';
import onboard from './flow-onboard.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.goto('http://localhost:4173/?reset=1'); await onboard(p, 'blaze', 'Ada');
await p.click('.island[data-year="year1"]'); await p.click('.topic[data-id="y1-add"]'); await p.waitForSelector('#arena');
await p.waitForTimeout(1500);
await p.mouse.move(100, 500); await p.mouse.down();
for (let i = 1; i <= 8; i++) { await p.mouse.move(100 + i * 25, 500 - i * 10); await p.waitForTimeout(16); }
console.log(await p.evaluate(() => ({ trail: window.__sna.arena.trail.length, particles: window.__sna.arena.particles.length, fx: window.__sna.arena.fx, down: window.__sna.arena.pointerDown })));
await p.screenshot({ path: '/tmp/fxmid.png' });
await b.close();

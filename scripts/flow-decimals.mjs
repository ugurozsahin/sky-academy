import onboard from './flow-onboard.mjs';

// A y5-decimals d2 number-line card (#1201): clear cards until one asks "What number is at A?".
export default async function run(p) {
  await p.evaluate(() => localStorage.setItem('sna:years', 'all')); await p.reload();
  await onboard(p, 'blaze', 'Ada');
  await p.waitForSelector('.home'); await p.click('.island[data-year="year5"]'); await p.click('.tab[data-s="maths"]'); await p.click('.topic[data-id="y5-decimals"]');
  await p.waitForSelector('#arena');
  for (let i = 0; i < 200; i++) {
    const s = await p.evaluate(() => window.__sna.state());
    if (s.ended) break;
    if (s.prompt && / at A\b/.test(s.prompt) && !s.waiting) break;
    if (await p.locator('#next').count()) { await p.click('#next'); continue; }
    await p.evaluate(() => window.__sna.answer()); await p.waitForTimeout(150);
  }
  await p.evaluate(() => window.__sna.setSpeed(0)).catch(() => {}); await p.waitForTimeout(500);
}

import onboard from './flow-onboard.mjs';

// A y5-fracequiv d1 bar card with 12 parts (#1195): the widest bar, which must fit the 390 px phone card.
// Clears cards until one asks "N of M parts are shaded" with M = 12; starts the topic again when a mission ends.
export default async function run(p) {
  await p.evaluate(() => localStorage.setItem('sna:years', 'all')); await p.reload();
  await onboard(p, 'blaze', 'Ada');
  for (let attempt = 0; attempt < 12; attempt++) {
    await p.waitForSelector('.home'); await p.click('.island[data-year="year5"]'); await p.click('.tab[data-s="maths"]'); await p.click('.topic[data-id="y5-fracequiv"]');
    await p.waitForSelector('#arena');
    for (let i = 0; i < 200; i++) {
      const s = await p.evaluate(() => window.__sna.state());
      if (s.ended) break;
      if (s.prompt && /of 12 parts are shaded/.test(s.prompt) && !s.waiting) { await p.evaluate(() => window.__sna.setSpeed(0)); await p.waitForTimeout(500); return; }
      if (await p.locator('#next').count()) { await p.click('#next'); continue; }
      await p.evaluate(() => window.__sna.answer()); await p.waitForTimeout(150);
    }
    await p.reload();
  }
  throw new Error('flow-fracequiv: no 12 part card found');
}

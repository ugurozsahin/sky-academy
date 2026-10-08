import onboard from './flow-onboard.mjs';

// A y5-x10 d2 build card with its decimal point bubble in flight (#1190): clear stage 1, then wait for a point-answer card.
export default async function run(p) {
  await p.evaluate(() => localStorage.setItem('sna:years', 'all')); await p.reload();
  await onboard(p, 'blaze', 'Ada');
  await p.waitForSelector('.home'); await p.click('.island[data-year="year5"]'); await p.click('.tab[data-s="maths"]'); await p.click('.topic[data-id="y5-x10"]');
  await p.waitForSelector('#arena');
  await p.evaluate(() => window.__sna.setSpeed(8));
  for (let i = 0; i < 400; i++) {
    const s = await p.evaluate(() => window.__sna.state());
    if (s.ended) break;
    if (s.stage >= 2 && s.answer && s.answer.includes('.') && !s.waiting) break;
    if (await p.locator('#next').count()) { await p.click('#next'); continue; }
    await p.evaluate(() => window.__sna.answer()); await p.waitForTimeout(150);
  }
  await p.evaluate(() => window.__sna.setSpeed(1)); await p.waitForTimeout(700);
}

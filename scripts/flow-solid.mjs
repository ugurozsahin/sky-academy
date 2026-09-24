// Reaches a Year 2 "How many flat faces has a cuboid?" card with its rotating three.js solid (#684): clears
// stage 1 at 4× through the __sna hooks, pins the session rng so stage 2 opens on the counting card.
import onboard from './flow-onboard.mjs';

export default async function run(p) {
  await p.addInitScript(() => { window.__SNA_FAST = 4; });
  await onboard(p, 'blaze', 'Ada');
  await p.waitForSelector('.home'); await p.click('.island[data-year="year2"]'); await p.click('.topic[data-id="y2-shapes"]');
  await p.waitForFunction(() => window.__sna?.state().prompt);
  const n = await p.evaluate(() => window.__sna.session.perStage);
  for (let i = 0; i < n; i++) {
    await p.waitForFunction(() => { const s = window.__sna?.state(); return s && !s.waiting && window.__sna.bubbles().some(b => b.label === s.answer); });
    await p.evaluate(() => window.__sna.answer());
    await p.waitForFunction(i => { const s = window.__sna?.state(); return s && (s.index > i || document.querySelector('.celebrate')); }, i);
  }
  await p.waitForSelector('.celebrate');
  await p.evaluate(() => { window.__sna.session.rng = () => 0.9; });
  await p.click('#next');
  await p.waitForFunction(() => (window.__sna.solid()?.frames ?? 0) > 10);
  await p.waitForFunction(() => window.__sna.bubbles().length > 0); await p.waitForTimeout(600);
}

import onboard from './flow-onboard.mjs';

export default async function run(p) {
  await onboard(p, 'blaze', 'Ada');
  await p.waitForSelector('.home'); await p.click('.island[data-year="reception"]'); await p.click('.topic[data-id="r-count"]');
  for (let i = 0; i < 5; i++) {
    await p.waitForFunction(() => { const s = window.__sna?.state(); return s && !s.waiting && window.__sna.bubbles().some(b => b.label === s.answer); }, null, { timeout: 20000 });
    await p.evaluate(() => window.__sna.answer());
    await p.waitForFunction((i) => { const s = window.__sna.state(); return s.index > i || document.querySelector('.celebrate'); }, i, { timeout: 20000 });
  }
  await p.waitForSelector('.celebrate'); await p.waitForTimeout(600);
}

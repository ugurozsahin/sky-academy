export default async function run(p) {
  await p.click('.avatar-card[data-id="frost"]'); await p.fill('#name', 'Ada'); await p.click('#go');
  await p.waitForSelector('.map'); await p.click('.island[data-year="reception"]'); await p.click('.topic[data-id="r-count"]');
  const stages = await p.evaluate(() => window.__sna.session.stages);
  for (let st = 0; st < stages; st++) {
    for (let i = 0; i < 5; i++) {
      await p.waitForFunction(() => { const s = window.__sna?.state(); return s && !s.waiting && window.__sna.bubbles().some(b => b.label === s.answer); }, null, { timeout: 20000 });
      await p.evaluate(() => window.__sna.answer());
      await p.waitForFunction((i) => { const s = window.__sna.state(); return s.index > i || document.querySelector('.celebrate'); }, i, { timeout: 20000 });
    }
    await p.waitForSelector('.celebrate'); if (st === 1) await p.screenshot({ path: '/tmp/stage2.png' }); await p.click('#next');
  }
  await p.waitForSelector('.results'); await p.waitForTimeout(900);
}

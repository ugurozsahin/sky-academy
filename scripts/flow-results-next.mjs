// #929: a won Reception maths mission with exactly one other topic left unstarred, for a screenshot of the
// results row's new "Next topic →" button. Seeds a save directly (skips onboarding) so `r-doubles` is the
// only one of Reception's 13 maths topics with no stars once `r-count`, played here, earns its own.
export default async function run(p) {
  await p.evaluate(() => {
    const other = ['r-subitise', 'r-compare', 'r-onemore', 'r-bonds', 'r-add', 'r-sub', 'r-counton', 'r-order', 'r-balance', 'r-share', 'r-oddeven'];
    localStorage.setItem('sna:v1', JSON.stringify({
      v: 1, name: 'Ada', avatar: 'frost', onboarded: true,
      progress: Object.fromEntries(other.map(id => [id, { stars: 1, best: 5, plays: 1 }])),
    }));
  });
  await p.reload();
  await p.waitForSelector('.map');
  await p.click('.island[data-year="reception"]');
  await p.click('.topic[data-id="r-count"]');
  const stages = await p.evaluate(() => window.__sna.session.stages);
  for (let st = 0; st < stages; st++) {
    for (let i = 0; i < 5; i++) {
      await p.waitForFunction(() => { const s = window.__sna?.state(); return s && !s.waiting && window.__sna.bubbles().some(b => b.label === s.answer); }, null, { timeout: 20000 });
      await p.evaluate(() => window.__sna.answer());
      await p.waitForFunction((i) => { const s = window.__sna.state(); return s.index > i || document.querySelector('.celebrate'); }, i, { timeout: 20000 });
    }
    await p.waitForSelector('.celebrate'); await p.click('#next');
  }
  await p.waitForSelector('.results'); await p.waitForTimeout(900);
}

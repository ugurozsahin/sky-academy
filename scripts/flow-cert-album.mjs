// Reaches the "My certificates" section of the Ninja Rewards screen (#110), seeded with one earned
// certificate directly via localStorage — faster than playing a full mission just to get there.
export default async function run(p) {
  await p.evaluate(() => {
    localStorage.setItem('sna:v1', JSON.stringify({
      v: 1, name: 'Ada', avatar: 'volt',
      certs: [{
        id: 'reception:r-count', name: 'Ada', avatar: 'volt', year: 'Reception', title: 'Counting to 10',
        stars: 3, score: 250, correct: 20, attempts: 20, date: '2026-09-10',
      }],
    }));
  });
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForSelector('.home');
  await p.click('#rewards');
  await p.waitForSelector('.cert-row');
  await p.locator('.cert-row').scrollIntoViewIfNeeded();   // the section sits below the sticker album, off the first screen
  await p.waitForTimeout(300);
}

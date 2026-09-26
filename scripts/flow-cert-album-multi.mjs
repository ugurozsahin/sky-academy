// Reaches "My certificates" seeded with five certificates of varied titles, stars and dates (#110), so the
// list's look with more than one row — and the vertical rhythm below the heading — can be screenshotted.
export default async function run(p) {
  await p.evaluate(() => {
    const cert = (id, title, stars, date, extra = {}) => ({
      id, name: 'Ada', avatar: 'volt', year: 'Reception', title, stars, score: 200 + stars * 20,
      correct: 18, attempts: 20, date, ...extra,
    });
    localStorage.setItem('sna:v1', JSON.stringify({
      v: 1, name: 'Ada', avatar: 'volt',
      certs: [
        cert('reception:r-count', 'Counting to 10', 3, '2026-09-15'),
        cert('reception:r-shapes', 'Sorting Shapes', 2, '2026-09-12'),
        cert('reception:sensei', 'Sensei training', 3, '2026-09-10', { training: true }),
        cert('year1:y1-add', 'Number Bonds to 20', 1, '2026-09-05'),
        cert('year1:y1-rhyme', 'Rhyming Words and a much longer mission title to test wrapping', 3, '2026-08-28'),
      ],
    }));
  });
  await p.goto(p.url().split('?')[0], { waitUntil: 'domcontentloaded' });   // drop ?reset=1 so the seeded save survives
  await p.waitForSelector('.home');
  await p.click('#rewards');
  await p.waitForSelector('.cert-row:not(.duel-row)');
  await p.locator('.isl-head:has-text("My certificates")').scrollIntoViewIfNeeded();
  await p.waitForTimeout(300);
}

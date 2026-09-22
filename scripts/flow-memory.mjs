// Memory Match, on the board you ask for. `MEM_THEME` picks it by the title shown on the card header
// ("3-D shapes" by default); `MEM_YEAR` picks the island. The theme is drawn at random by `memoryScreen`, so
// this re-enters the screen until the wanted one comes up rather than stubbing `Math.random` — what it shoots
// is then the real screen a child gets. Added for the #372 review: the Year 2 3-D board is the one deck whose
// card count is not a multiple of four, and nothing else in the repository renders a board to look at it.
const YEAR = process.env.MEM_YEAR || 'year2';
const THEME = process.env.MEM_THEME || '3-D shapes';

export default async function run(p) {
  await p.click('.avatar-card[data-id="blaze"]'); await p.click('#next'); await p.fill('#name', 'Ada'); await p.click('#go');   // #67 wizard
  await p.waitForSelector('#intro-go'); await p.click('#intro-go');
  await p.waitForSelector('.home');
  await p.click(`.island[data-year="${YEAR}"]`);
  for (let tries = 0; tries < 60; tries++) {
    await p.click('#memory');
    await p.waitForSelector('#cards .card');
    if ((await p.textContent('.mem-head .ttl'))?.includes(THEME)) {
      // `MEM_REVEAL=1` turns every card face up at once — not a move a child can make, but the only way to
      // see every face's text at the board's real card size in one shot.
      if (process.env.MEM_REVEAL) await p.evaluate(() => document.querySelectorAll('#cards .card').forEach(c => c.classList.add('up')));
      await p.waitForTimeout(700); return;
    }
    await p.click('#back');
    await p.waitForSelector('#memory');
  }
  throw new Error(`no "${THEME}" board came up for ${YEAR} in 60 draws`);
}

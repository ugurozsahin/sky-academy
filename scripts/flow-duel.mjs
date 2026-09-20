// Ninja Duel (#16): seed a player, open the Year 1 island and start a duel; wait for both arenas' first wave.
export default async function run(p) {
  await p.click('.avatar-card[data-id="blaze"]'); await p.click('#next'); await p.fill('#name', 'Ada'); await p.click('#go');   // #67 wizard
  await p.waitForSelector('#intro-go'); await p.click('#intro-go');
  await p.waitForSelector('.home'); await p.click('.island[data-year="year1"]'); await p.click('#duel');
  await p.waitForSelector('.duel-screen'); await p.waitForTimeout(2600);
}

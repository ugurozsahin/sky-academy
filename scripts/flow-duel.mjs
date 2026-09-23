// Ninja Duel (#16): seed a player, open the Year 1 island and start a duel; wait for both arenas' first wave.
import onboard from './flow-onboard.mjs';

export default async function run(p) {
  await onboard(p, 'blaze', 'Ada');
  await p.waitForSelector('.home'); await p.click('.island[data-year="year1"]'); await p.click('#duel');
  await p.waitForSelector('.duel-screen'); await p.waitForTimeout(2600);
}

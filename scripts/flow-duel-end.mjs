// Ninja Duel (#16): play a whole match through the screen's hooks (Player 1 wins 6–4) and stop on the match-end overlay.
import onboard from './flow-onboard.mjs';

export default async function run(p) {
  await onboard(p, 'blaze', 'Ada');
  await p.waitForSelector('.home'); await p.click('.island[data-year="year1"]'); await p.click('#duel');
  await p.waitForSelector('.duel-screen'); await p.evaluate(() => window.__sna.setSpeed(4));
  for (let r = 1; r <= 10; r++) {
    const who = r <= 6 ? 'a' : 'b';
    await p.waitForFunction(([r, who]) => { const s = window.__sna.state(); return s.round === r && !s.decided && window.__sna.bubbles(who).some(b => b.label === s.answer); }, [r, who]);
    await p.evaluate(who => window.__sna.answer(who), who);
  }
  await p.waitForSelector('.duel-end'); await p.waitForTimeout(400);
}

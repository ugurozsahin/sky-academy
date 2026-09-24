// #348: a y2-sentence wave carrying "After lunch we painted colourful pictures." — two of its option
// labels, `colourful` and `pictures.`, are unbreakable words the new LABEL_HARD_MIN_FS floor rescues from
// spilling out of their bubble. The flow keeps drawing d3 cards until it lands on that one.
import onboard from './flow-onboard.mjs';

export default async function run(p) {
  await onboard(p, 'blaze', 'Ada');
  await p.waitForSelector('.home');
  await p.click('.island[data-year="year2"]'); await p.click('.tab[data-s="writing"]');
  await p.click('.topic[data-id="y2-sentence"]');
  await p.waitForSelector('#arena');
  await p.waitForFunction(() => window.__sna?.state().prompt);
  await p.evaluate(() => {
    const s = window.__sna.session;
    s.stage = 4; s.index = 0;   // year2 diffs [1, 2, 2, 3, 3] → stage 4 is difficulty 3
    for (let i = 0; i < 60 && !s.current?.answer.includes('colourful'); i++) { s.index = 0; s.nextQuestion(); }
  });
  await p.waitForTimeout(4200);
}

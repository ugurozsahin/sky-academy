import onboard from './flow-onboard.mjs';

/** Reaches a ten-frame question (`r-bonds`, whose visual is unconditional — every card carries one). */
export default async function run(p) {
  await onboard(p, 'blaze', 'Ada');
  await p.waitForSelector('.home'); await p.click('.island[data-year="reception"]'); await p.click('.topic[data-id="r-bonds"]');
  await p.waitForSelector('#arena'); await p.waitForTimeout(1800);
}

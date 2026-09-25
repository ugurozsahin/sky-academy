import onboard from './flow-onboard.mjs';

/** Reaches a five-frame counting question (`r-count`, whose visual is unconditional). */
export default async function run(p) {
  await onboard(p, 'blaze', 'Ada');
  await p.waitForSelector('.home'); await p.click('.island[data-year="reception"]'); await p.click('.topic[data-id="r-count"]');
  await p.waitForSelector('#arena'); await p.waitForTimeout(1800);
}

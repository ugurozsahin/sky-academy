import onboard from './flow-onboard.mjs';

export default async function run(p) {
  await onboard(p, 'blaze', 'Ada');
  await p.waitForSelector('.home'); await p.click('.island[data-year="year1"]'); await p.click('.topic[data-id="y1-add"]');
  await p.waitForSelector('#arena'); await p.waitForTimeout(1800);
}

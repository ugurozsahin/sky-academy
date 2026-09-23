import onboard from './flow-onboard.mjs';

export default async function run(p) {
  await onboard(p, 'volt', 'Ada');
  await p.waitForSelector('.home'); await p.click('#change-av');
  await p.waitForSelector('.change-avatar');
}

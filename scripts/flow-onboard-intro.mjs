import { enterName } from './flow-onboard.mjs';

export default async function run(p) {
  await enterName(p, 'volt', 'Ada');
  await p.waitForSelector('.intro-card');
}

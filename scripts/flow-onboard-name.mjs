import { pickNinja } from './flow-onboard.mjs';

export default async function run(p) {
  await pickNinja(p, 'volt');
  await p.waitForSelector('#name');
}

import onboard from './flow-onboard.mjs';

// A word game whose card holds the sentence (#2314): Year 2 Joining Words, mid-arena, through the deep link.
export default async function run(p) {
  await onboard(p, 'blaze', 'Ada');
  await p.waitForSelector('.home');
  await p.goto(`${new URL(p.url()).origin}/?topic=y2-conjunction`);
  await p.waitForSelector('#arena'); await p.waitForTimeout(1800);
}

// Reaches a won mission, then forces the certificate full-screen fallback (#50) so it can be screenshotted.
import run0 from './flow-results.mjs';
export default async function run(p) {
  await run0(p);   // play a full mission → results screen with the 🎓 button
  await p.evaluate(() => {
    navigator.canShare = () => false;               // skip the share sheet
    window.claude = { use: async () => null };       // artifact viewer with no downloads grant → full-screen fallback
  });
  await p.click('#cert');
  await p.waitForSelector('.cert-view');
  await p.waitForTimeout(400);
}

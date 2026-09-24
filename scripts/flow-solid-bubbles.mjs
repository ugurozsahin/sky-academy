// Reaches a Year 1 "Which is a …?" wave with a rotating three.js solid inside each shape bubble (#684): waits
// until the solids have been baked and drawn, so the shot shows art rather than the emoji it replaces.
import onboard from './flow-onboard.mjs';

export default async function run(p) {
  await onboard(p, 'blaze', 'Ada');
  await p.waitForSelector('.home');
  // The first-play tutorial hand would sit over the wave; this shot is of the bubbles, so mark it seen.
  await p.evaluate(() => { const k = 'sna:v1'; localStorage.setItem(k, JSON.stringify({ ...JSON.parse(localStorage.getItem(k) ?? '{}'), tutorialSeen: true })); });
  await p.click('.island[data-year="year1"]'); await p.click('.topic[data-id="y1-shapes3d"]');
  await p.waitForFunction(() => (window.__sna?.solidArt()?.draws ?? 0) > 40 && window.__sna.bubbles().length >= 3);
  await p.waitForTimeout(700);
}

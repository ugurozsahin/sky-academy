// Reaches the certificate full-screen viewer opened from the "My certificates" album (#110), zoomed in,
// so the tap-to-zoom interaction can be screenshotted alongside the album itself.
import run0 from './flow-cert-album.mjs';
export default async function run(p) {
  await run0(p);
  await p.click('.cert-open');
  await p.waitForSelector('.cert-view');
  await p.waitForTimeout(300);
  await p.click('.cert-view-img');   // tap to zoom in
  await p.waitForTimeout(300);
}

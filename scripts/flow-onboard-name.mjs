export default async function run(p) {
  await p.click('.avatar-card[data-id="volt"]'); await p.click('#next');
  await p.waitForSelector('#name');
}

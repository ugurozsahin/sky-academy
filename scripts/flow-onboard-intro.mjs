export default async function run(p) {
  await p.click('.avatar-card[data-id="volt"]'); await p.fill('#name', 'Ada'); await p.click('#go');
  await p.waitForSelector('.intro-card');
}

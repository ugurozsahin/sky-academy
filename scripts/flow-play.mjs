export default async function run(p) {
  await p.click('.avatar-card[data-id="blaze"]'); await p.fill('#name', 'Ada'); await p.click('#go');
  await p.waitForSelector('.home'); await p.click('.island[data-year="year1"]'); await p.click('.topic[data-id="y1-add"]');
  await p.waitForSelector('#arena'); await p.waitForTimeout(1800);
}

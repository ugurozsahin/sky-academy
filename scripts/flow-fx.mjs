export default async function run(p) {
  await p.click('.avatar-card[data-id="blaze"]'); await p.fill('#name', 'Ada'); await p.click('#go');
  await p.waitForSelector('.map'); await p.screenshot({ path: '/tmp/map.png' });
  await p.click('.island[data-year="year1"]'); await p.waitForSelector('.island-screen'); await p.screenshot({ path: '/tmp/island.png' });
  await p.click('.topic[data-id="y1-add"]'); await p.waitForSelector('#arena');
  const b = await p.waitForFunction(() => { const s = window.__sna; const hit = s.bubbles().find(x => x.label === s.state().answer && x.y > 150 && x.y < window.innerHeight - 40); return hit ? JSON.stringify(hit) : null; }, null, { timeout: 15000 });
  const { x, y, r } = JSON.parse(await b.jsonValue());
  await p.mouse.move(x - r * 2, y + r); await p.mouse.down();
  for (let i = 1; i <= 8; i++) { await p.mouse.move(x - r * 2 + (r * 4 * i) / 8, y + r - (r * 2 * i) / 8); await p.waitForTimeout(16); if (i === 7) await p.screenshot({ path: '/tmp/fxmid.png' }); }
  await p.waitForTimeout(60);
}

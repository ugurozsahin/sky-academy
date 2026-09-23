// Grown-ups dashboard screenshot: pick an avatar, seed some realistic progress, pass the gate.
import onboard from './flow-onboard.mjs';

export default async function run(p) {
  await onboard(p, 'volt', 'Ada');
  await p.waitForSelector('.home');
  await p.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('sna:v1'));
    raw.progress = {
      'y1-add': { stars: 3, best: 180, plays: 6, hits: 52, tries: 60 },
      'y1-sub': { stars: 1, best: 60, plays: 4, hits: 9, tries: 30 },
      'y1-bonds': { stars: 2, best: 120, plays: 3, hits: 14, tries: 20 },
      'y1-time': { stars: 2, best: 110, plays: 2, hits: 12, tries: 18 },
      'y1-coins': { stars: 1, best: 70, plays: 2, hits: 8, tries: 22 },
      'r-count': { stars: 3, best: 90, plays: 3, hits: 14, tries: 15 },
      'y2-tables': { stars: 1, best: 70, plays: 2, hits: 10, tries: 24 },
    };
    raw.endless = { year1: 140 }; raw.sprint = { year1: 18 }; raw.boss = { year1: 2 }; raw.memory = { year1: 3 }; raw.training = { year1: 5 };
    raw.coins = 210; raw.stickers = ['volt', 'blaze', 'splash']; raw.streak = { last: raw.streak?.last || '', days: 5 };
    localStorage.setItem('sna:v1', JSON.stringify(raw));
  });
  await p.goto(p.url().split('?')[0], { waitUntil: 'domcontentloaded' });   // drop ?reset=1 so the seeded save survives
  await p.waitForSelector('.home');
  await p.click('#grownups');
  const q = await p.locator('#gate-q').textContent();
  const [a, b] = q.split('×').map(s => parseInt(s.trim(), 10));
  await p.fill('#gate-input', String(a * b));
  await p.click('#gate-go');
  await p.waitForSelector('.parents-dash');
}

// A stage-3 `y2-duration` card — the longest prompt the game shows (#298 slice 3): "It starts at
// quarter past 10 and lasts three quarters of an hour. When does it end?" at 83 characters, against
// 65 for the previous longest (`y1-position`). The shot exists to show that prompt wrapping in the
// 390 px viewport, so the flow keeps drawing until it gets a card over 70 characters.
export default async function run(p) {
  // #67 split onboarding into a ninja step, a name step and an introduction — the same sequence
  // `pickAvatar()` in `tests/e2e/game.spec.ts` walks. The older `flow-*.mjs` scripts still fill `#name`
  // on the avatar screen and time out there.
  await p.click('.avatar-card[data-id="blaze"]'); await p.click('#next');
  await p.fill('#name', 'Ada'); await p.click('#go');
  await p.waitForSelector('.intro-card'); await p.click('#intro-go');
  await p.waitForSelector('.home');
  await p.click('.island[data-year="year2"]'); await p.click('.tab[data-s="maths"]');
  await p.click('.topic[data-id="y2-duration"]');
  await p.waitForSelector('#arena');
  await p.waitForFunction(() => window.__sna?.state().prompt);
  await p.evaluate(() => {
    const s = window.__sna.session;
    s.stage = 4; s.index = 0;                       // stages map [1, 2, 2, 3, 3] → stage 4 is difficulty 3
    for (let i = 0; i < 40 && (s.current?.prompt.length ?? 0) <= 70; i++) { s.index = 0; s.nextQuestion(); }
  });
  // Long enough for the wave the jump interrupted to fall off screen: the bubbles of the card that was up
  // before `nextQuestion()` are still in flight for a second or so, and they are not this card's options.
  await p.waitForTimeout(3600);
}

// The first-run wizard walk (#67: ninja pick → name → introduction), shared by every other `flow-*.mjs` so
// the sequence is written once — the same one `pickAvatar()` in `tests/e2e/game.spec.ts` drives — instead of
// each script keeping its own copy to drift out of step with the app (#370).

export async function pickNinja(p, avatarId) {
  await p.click(`.avatar-card[data-id="${avatarId}"]`);
  await p.click('#next');   // ninja step → name step, its own screen
}

export async function enterName(p, avatarId, name) {
  await pickNinja(p, avatarId);
  await p.fill('#name', name);
  await p.click('#go');
}

export default async function onboard(p, avatarId, name) {
  await enterName(p, avatarId, name);
  await p.waitForSelector('.intro-card');   // first run continues into the introduction
  await p.click('#intro-go');
}

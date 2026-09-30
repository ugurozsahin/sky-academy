import { test, expect } from './fixtures';

// #1460: the unit test feeds muteSpeech a fake engine; this is the real one, in the real page.
test('every utterance handed to the real speech engine is at volume 0 (#1460)', async ({ page }) => {
  await page.goto('/');
  const volume = await page.evaluate(() => {
    const u = new SpeechSynthesisUtterance('quiet please');
    u.volume = 1;
    window.speechSynthesis.speak(u);
    window.speechSynthesis.cancel();
    return u.volume;
  });
  expect(volume).toBe(0);
});

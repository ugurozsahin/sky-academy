/**
 * #1460, #2148: the one way a Playwright browser is made silent, shared by the e2e fixture (`./fixtures.ts`) and
 * every script under `scripts/` that launches Chromium. Plain JavaScript with no imports, so a script runs it
 * under bare Node and Playwright can serialise `muteSpeech` into a page. Types: `./mute.d.mts`.
 *
 * Two sounds, two switches. `--mute-audio` silences Chromium's own output, the Web Audio sound effects; headless
 * adds it by itself, a headed or `--ui` run does not. It never reaches the OS speech engine Chromium hands
 * `speechSynthesis` to on macOS, so `muteSpeech` sets every utterance to volume 0 instead, which that engine
 * (AVSpeechSynthesizer) honours. `speak` is still called and voices, events and `speaking` stay real, so the
 * voice probe, every pacing test and every speech spy see what they always did.
 */
export const MUTE_ARGS = ['--mute-audio'];

/** An init script: wraps `SpeechSynthesis.prototype.speak` to zero the utterance's volume, then passes the call on. */
export function muteSpeech() {
  const proto = globalThis.SpeechSynthesis?.prototype;
  if (!proto) return;
  const speak = proto.speak;
  proto.speak = function (u) { u.volume = 0; return speak.call(this, u); };
}

/**
 * `chromium.launch` for a script: launched with `MUTE_ARGS`, and every context or page it opens runs `muteSpeech`
 * first. It hands back only `newContext`, `newPage` and `close`, so a script that reaches for anything else on the
 * browser fails loudly instead of opening a page that can speak.
 */
export async function launchSilent(chromium, options = {}) {
  const browser = await chromium.launch({ ...options, args: [...(options.args ?? []), ...MUTE_ARGS] });
  const newContext = async (contextOptions) => {
    const context = await browser.newContext(contextOptions);
    await context.addInitScript(muteSpeech);
    return context;
  };
  return { newContext, newPage: async (pageOptions) => (await newContext(pageOptions)).newPage(), close: () => browser.close() };
}

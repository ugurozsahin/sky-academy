/**
 * #1460: an init script that silences the platform's speech engine without replacing it. `--mute-audio` does not
 * reach an OS text-to-speech engine, and most tests never stub one. Volume 0 keeps voices, events and `speaking`
 * real, so the voice probe and every pacing test see what they always did. No imports: Playwright serialises it.
 */
export function muteSpeech(): void {
  const proto = (globalThis as { SpeechSynthesis?: { prototype: { speak(u: { volume: number }): void } } }).SpeechSynthesis?.prototype;
  if (!proto) return;
  const speak = proto.speak;
  proto.speak = function (this: unknown, u) { u.volume = 0; return speak.call(this, u); };
}

// Voice ranking, shared by the web engine (speech.ts) and the Android native engine (speech-native.ts, #881).
// Its own leaf module so neither engine has to import the other's file: speech.ts wires which engine speaks;
// speech-native.ts only needs a voice list to rank, not speech.ts's engine plumbing.

/** Minimal shape of SpeechSynthesisVoice (or a native TTS voice) so the ranking is testable in node. */
export interface VoiceLike { name: string; lang: string; localService?: boolean }
/**
 * Score a voice for reading to a 4–7 year old: British English first, warm/child voices first,
 * "natural"/online voices over robotic local ones. Higher = better; < 0 = unusable.
 */
export function voiceScore(v: VoiceLike): number {
  const lang = v.lang.replace('_', '-').toLowerCase(); const name = v.name;
  if (!lang.startsWith('en')) return -1;
  let s = lang === 'en-gb' ? 100 : /en-(ie|au|nz)/.test(lang) ? 60 : 30;
  if (/maisie/i.test(name)) s += 40;                                        // Microsoft's en-GB child voice
  else if (/libby|sonia|kate|serena|martha|google uk english female|moira|fiona/i.test(name)) s += 30;
  else if (/female/i.test(name)) s += 20;
  else if (/daniel|ryan|thomas|oliver|google uk english male|arthur/i.test(name)) s += 10;
  if (/natural|neural|online|premium|enhanced/i.test(name)) s += 8;
  if (v.localService === false) s += 4;                                     // cloud voices sound less robotic
  if (/eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley|bad news|bells|boing|bubbles|cellos|jester|organ|superstar|trinoids|whisper|wobble|zarvox|albert|fred|junior|ralph|kathy/i.test(name)) s -= 100; // Apple novelty voices: any plain English voice beats them
  return s;
}
export function chooseVoice<T extends VoiceLike>(voices: T[]): T | null {
  let best: T | null = null, bs = -1;
  for (const v of voices) { const s = voiceScore(v); if (s > bs) { best = v; bs = s; } }
  return best;
}

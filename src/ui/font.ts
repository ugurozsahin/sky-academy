// Canvas font readiness (#44).
//
// Bubble labels, tracing letters and the certificate are drawn on a canvas in Fredoka, which arrives over the
// network from Google Fonts. Canvas text has no equivalent of CSS `font-display: swap`: whichever face is
// available at the instant `fillText` runs is baked into those pixels for good. So on a slow connection the
// first wave launches with its numbers in the fallback face and they change shape mid-flight — the one item
// on the code-health list a child can actually see.
//
// Waiting for it is not simply `document.fonts.load(...)`. The @font-face rules live in the stylesheet Google
// serves, so until that stylesheet is parsed the document's font set is EMPTY — and an empty set answers
// `check()` with **true** ("nothing matches the query, system fonts will do"), which is precisely the wrong
// answer at the only moment the question matters. So this waits for a Fredoka face to appear in the set
// first, then loads it, and only then reports ready.
//
// A slow or dead network must never stop a child playing, so the whole wait is capped: on timeout the game
// starts anyway in the fallback face, exactly as it does today.

/** The face the gate probes. 700 is the heaviest weight `index.html` asks Google for; the 800/900 the arena
 *  draws are synthesised by the browser from that face, so its arrival is what unblocks all of them. */
export const FONT_PROBE = '700 24px "Fredoka"';
/** Longest the first wave may be held back. Beyond this the fallback face is the lesser evil. */
export const FONT_TIMEOUT_MS = 1200;

const familyOf = (f: FontFace) => f.family.replace(/["']/g, '');

/** True once a Fredoka @font-face exists in the set — i.e. Google's stylesheet has been parsed. */
function declared(fonts: FontFaceSet): boolean {
  let found = false;
  fonts.forEach(f => { if (familyOf(f) === 'Fredoka') found = true; });
  return found;
}

const defaultFonts = () => (typeof document !== 'undefined' ? document.fonts : undefined);

let pending: Promise<boolean> | null = null;

/**
 * Resolves `true` once Fredoka can be drawn on a canvas, `false` if the wait gave up. Never rejects and never
 * waits longer than `timeoutMs`. The result is cached: the font loads once per page, so every later caller
 * (the next mission, the tracing screen, the certificate) gets the answer immediately.
 */
export function fontReady(timeoutMs = FONT_TIMEOUT_MS, fonts: FontFaceSet | undefined = defaultFonts()): Promise<boolean> {
  if (pending) return pending;
  if (!fonts) return (pending = Promise.resolve(true));   // no Font Loading API (jsdom, ancient browser): draw at once
  // ONE deadline over the WHOLE wait, not just the polling loop. `fonts.load()` settles when the woff2 fetch
  // completes or errors, and a stalled socket does neither — the browser's own font timeout runs to minutes.
  // Capping only the loop left exactly the case this exists for uncovered: Google's ~1 kB stylesheet lands
  // fast, so `declared()` flips at once, and it is the font file behind it that crawls. The screen would then
  // sit on a question with no bubbles and no read-aloud for ever — unplayable, where the bug being fixed is
  // merely ugly. (Found reviewing #139; the rail for it is "gives up even when load() never settles".)
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<boolean>(resolve => {
    timer = setTimeout(() => { expired = true; resolve(false); }, timeoutMs);
  });
  const probe = (async () => {
    while (!declared(fonts)) {                            // the stylesheet has not been parsed yet
      if (expired) return false;                          // and stop polling once the deadline has passed
      await new Promise(r => setTimeout(r, 30));
    }
    await fonts.load(FONT_PROBE);
    return fonts.check(FONT_PROBE);
  })().catch(() => false);                                // a rejected load() is a "no", never an unhandled throw
  pending = Promise.race([probe, deadline]).then(ok => { clearTimeout(timer); return ok; });
  return pending;
}

/** Test-only: forget the cached answer so the next call probes again. */
export function resetFontReady() { pending = null; }

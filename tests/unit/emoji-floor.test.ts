import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { DIGRAPH_WORDS } from '../../src/curriculum/year1';
import { TOPICS } from '../../src/curriculum';
import { SURVEYS } from '../../src/curriculum/year2/measure';

/**
 * #875: three curriculum glyphs were Emoji 13.0 — 🪙 (`coin`), 🪢 (`skipping`), 🪵 (`log`) — which draw as
 * empty boxes on Android 10, a common cheap family tablet (`minSdkVersion = 24`, `android/variables.gradle`).
 * This is the narrow half of that issue: a regression pin so none of the three can silently return, checked
 * by driving every `.ts` file under `src/curriculum/` for its literal text rather than reading a fixed list
 * of files, so a future curriculum split (already happened once here — `year2.ts` → `year2/*.ts` mid-issue)
 * cannot make the sweep miss a directory silently.
 *
 * **This is not the comprehensive floor rail the issue also asks for** (a fixture of every glyph's Unicode
 * emoji version, asserting all are ≤ 12.0). Building that fixture correctly needs an authoritative source —
 * the issue's own proposed fix says to build it by looking each glyph up in Unicode's `emoji-test.txt` — and
 * this session has no route to one: `curl https://unicode.org/...` and a general web fetch both come back
 * `403` from this environment's egress policy (`recentRelayFailures` in the agent-proxy status), and no
 * offline Unicode data is installed here either. Hand-typing ~158 version numbers from memory risks exactly
 * the failure this rail exists to prevent — a wrongly-cleared glyph reads as "checked" and ships broken — so
 * this PR does not attempt it. Left `Part of #875`, not `Closes`: the comprehensive sweep needs either a
 * session with real internet access (the owner's Mac session can reach it) or a vendored `emoji-test.txt`
 * excerpt added as a fixture, the same shape `#643` is waiting on for its own word list.
 *
 * Literal-glyph substring match only, over each file's whole text — comments count too, same as code. A
 * `\u{1FAA2}`-style escape or a variation-selector variant of the same base codepoint would slip past this
 * check; narrow enough for a three-word regression pin, not for the comprehensive rail above.
 */
describe('emoji floor (#875): three already-found above-floor glyphs cannot return', () => {
  const RETIRED = ['🪙', '🪢', '🪵'];

  function curriculumFiles(dir: string): string[] {
    let out: string[] = [];
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) out = out.concat(curriculumFiles(p));
      else if (name.endsWith('.ts')) out.push(p);
    }
    return out;
  }

  const files = curriculumFiles(join(__dirname, '../../src/curriculum'));

  it('found more than a couple of files, so this sweep is not vacuous', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(RETIRED)('%s does not appear in any src/curriculum/**/*.ts file', (glyph) => {
    const hit = files.find(f => readFileSync(f, 'utf8').includes(glyph));
    expect(hit, `${glyph} is back, in ${hit}`).toBeUndefined();
  });

  /**
   * The negative sweep above only proves a retired glyph is gone — it says nothing about what replaced it,
   * so a future edit could revert `oil`'s icon, `y1-coins`' icon or the survey row's label/emoji pairing
   * without any test noticing (`pr-test-analyzer` review of #875). These three pin the replacement values.
   */
  it('the oi-digraph word is oil, with its floor-compliant icon', () => {
    expect(DIGRAPH_WORDS.find(([w]) => w === 'oil')).toEqual(['oil', 'oi', '🛢️']);
  });

  it('the y1-coins topic icon is 💷, not 🪙', () => {
    expect(TOPICS.find(t => t.id === 'y1-coins')?.icon).toBe('💷');
  });

  it("the 'playtime game' survey's swapped row is 🤸 cartwheels", () => {
    const survey = SURVEYS.find(s => s.what === 'playtime game');
    expect(survey?.rows).toContainEqual(['🤸', 'cartwheels']);
  });
});

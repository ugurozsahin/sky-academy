import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { DIGRAPH_WORDS } from '../../src/curriculum/year1';
import { TOPICS } from '../../src/curriculum';
import { SURVEYS } from '../../src/curriculum/year2/measure';

const SEQ = /\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*/gu;
const FLOOR = 12.0;
const strip = (g: string) => g.replaceAll('\uFE0F', '');
/** Emoji sequences in `text` that the fixture does not list (variation selectors ignored). */
const unlisted = (text: string, listed: ReadonlySet<string>) => [...new Set([...text.matchAll(SEQ)].map(m => strip(m[0])))].filter(g => !listed.has(g));

/**
 * #875: three curriculum glyphs were Emoji 13.0 — 🪙 (`coin`), 🪢 (`skipping`), 🪵 (`log`) — which draw as
 * empty boxes on Android 10, a common cheap family tablet (`minSdkVersion = 24`, `android/variables.gradle`).
 * This is the narrow half of that issue: a regression pin so none of the three can silently return, checked
 * by driving every `.ts` file under `src/curriculum/` for its literal text rather than reading a fixed list
 * of files, so a future curriculum split (already happened once here — `year2.ts` → `year2/*.ts` mid-issue)
 * cannot make the sweep miss a directory silently.
 *
 * The comprehensive floor rail is the second `describe` below (#875): `fixtures/emoji-floor.txt` lists every
 * emoji sequence the curriculum sources spell, with its Emoji version and CLDR name, copied from Unicode's
 * `emoji-test.txt` (UTS #51 v18.0 of 2026-02-05, via the unicode-org/cldr copy on raw.githubusercontent.com —
 * unicode.org itself is refused by the cloud egress policy). The floor is **Emoji 12.0 / Android 10**.
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

describe('emoji floor (#875): every curriculum glyph is Emoji 12.0 or older', () => {
  const rows = readFileSync(join(__dirname, 'fixtures/emoji-floor.txt'), 'utf8').trimEnd().split('\n').map(l => l.split('\t') as [string, string, string]);
  const listed = new Set(rows.map(r => r[0]));
  const files = (function walk(dir: string): string[] {
    return readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : n.endsWith('.ts') ? [p] : []; });
  })(join(__dirname, '../../src/curriculum'));

  it('the fixture is sorted, unique, three columns, every version at or under the floor', () => {
    expect(rows.length).toBeGreaterThan(100);
    expect(listed.size).toBe(rows.length);
    for (const r of rows) { expect(r, r[0]).toHaveLength(3); expect(Number(r[1]), `${r[0]} ${r[2]}`).toBeLessThanOrEqual(FLOOR); expect(r[2].length).toBeGreaterThan(0); }
    const cps = rows.map(r => r[0].codePointAt(0)!);
    expect(cps, 'sorted by first code point').toEqual([...cps].sort((a, b) => a - b));
  });

  it.each(files.map(f => [f.slice(f.indexOf('src/curriculum'))]))('%s spells only listed glyphs', (f) => {
    expect(unlisted(readFileSync(join(__dirname, '../..', f), 'utf8'), listed), 'add the glyph to the fixture with its Emoji version, or replace it').toEqual([]);
  });

  it('the residue is measured: every fixture line is still spelled by a source file', () => {
    const all = files.map(f => strip(readFileSync(f, 'utf8'))).join('\n');
    expect(rows.filter(r => !all.includes(r[0])).map(r => r[0]), 'unused fixture lines').toEqual([]);
  });

  it('proves red: an unlisted glyph (🪙, E13.0) is reported, a listed one (🛢️) and a ZWJ-free text are not', () => {
    expect(unlisted('const a = "🪙";', listed)).toEqual(['🪙']);
    expect(unlisted("['oil', 'oi', '🛢️']", listed)).toEqual([]);
    expect(unlisted('no emoji here', listed)).toEqual([]);
  });
});

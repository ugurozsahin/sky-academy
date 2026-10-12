import { describe, expect, it } from 'vitest';
import { code, e2eSpecFiles } from './helpers/sources';

// #1797: the `@smoke` "a full mission (5 stages)" test lost 3 runs in 10 at `--workers=5` on a 10-core Mac.
// One of its two failure shapes was `expect(page.locator('#cert')).toBeDisabled()` receiving *enabled*: the
// handler (`play-results.ts`, and `duel.ts` for a duel) sets `b.disabled = true` synchronously and clears it
// once the fake `save` resolves, so the disabled state lasts exactly as long as the fake's `setTimeout`. A
// polled `toBeDisabled()` from the Node side has to land its first poll inside that window; under load it
// does not, and the test fails on behaviour that is correct. Lengthening the delay only moves the threshold
// (`duel.spec.ts` went 60 ms -> 600 ms for #860 and the mission test still fell at 60 ms).
// The observation belongs where the window is: the fake `save` itself reads `#cert.disabled` into a flag the
// moment it is called, which is inside the handler's own `try`, and the test asserts the flag plus the
// settled state (`toBeEnabled()`, the toast or message, the filename). So no e2e spec reads `disabled` on a
// `#cert` locator from outside — `toBeDisabled(...)` with or without a timeout, `.not.toBeEnabled(...)`, or a
// one-shot `isDisabled()`, which is the same race without even the poll. The selector may carry a scope
// (`.duel-end #cert`), and the assertion may sit on another line from the locator, hence the two-token test
// over a two-line window rather than one regex over one line. Comments are stripped by `code()` first, so
// this very explanation does not trip the rail where it is quoted in a spec. Known hole: a locator held in a
// variable (`const cert = page.locator('#cert')` … `expect(cert).toBeDisabled()`) is outside the window —
// neither spec writes `#cert` that way today; widen the window if one starts to. This is a "do not
// reintroduce exactly this" rail, not a proof that no Node-side read of `#cert.disabled` exists: it pins the
// three shapes the specs had, and `toHaveJSProperty('disabled', …)`, `toHaveAttribute('disabled', …)`,
// `page.isDisabled('#cert')` or a `$eval` polled from Node would pass it (review of #1797, N3).
// `#next`, `#go` and the other `toBeDisabled()` sites are settled states, not transient ones, and stay.
const CERT_LOCATOR = /locator\((['"`])[^'"`]*#cert\1\)/;
const POLLED_DISABLED = /\.(toBeDisabled|not\.toBeEnabled|isDisabled)\(/;
// The assertion itself, not just the flag's initialiser: `__wasDisabled = null` alone would satisfy a bare
// `includes('__wasDisabled')` after the `toBe(true)` line was deleted — the exact regression this guards.
const FLAG_ASSERTED = /__wasDisabled\)[^\n]*\.toBe\(true\)/;
// A hit is reported at its line in the real file, not in `code()`'s output (review of #1797, N2): stripping
// collapses every `/** */` block to one space, so the stripped text's line numbers run below the file's (the
// red run on main printed `game.spec.ts:1178` for real line 1259). The stripped line is looked up in the raw text.
const realLine = (raw: string, stripped: string) => { const i = raw.split('\n').findIndex(r => r.includes(stripped.trim())); return i === -1 ? '?' : String(i + 1); };

describe('a transient disabled state is read inside the fake save, never polled from outside (#1797)', () => {
  const specs = e2eSpecFiles();

  it('the token tests catch the shapes they ban, and not the fix', () => {
    const banned = "await expect(page.locator('.duel-end #cert')).toBeDisabled();";
    expect(banned).toMatch(CERT_LOCATOR); expect(banned).toMatch(POLLED_DISABLED);
    expect("await expect(page.locator('#cert')).toBeDisabled({ timeout: 2000 });").toMatch(POLLED_DISABLED);
    expect("await expect(page.locator('#cert')).not.toBeEnabled();").toMatch(POLLED_DISABLED);
    expect("expect(await page.locator('#cert').isDisabled()).toBe(true);").toMatch(POLLED_DISABLED);
    expect("await expect(page.locator('#next')).toBeDisabled();").not.toMatch(CERT_LOCATOR);
    expect("await expect(page.locator('.duel-end #cert-msg')).toHaveText('x');").not.toMatch(CERT_LOCATOR);
    expect("await expect(page.locator('#cert')).toBeEnabled();").not.toMatch(POLLED_DISABLED);
    expect("(window as any).__wasDisabled = (document.querySelector('#cert') as HTMLButtonElement).disabled;").not.toMatch(POLLED_DISABLED);
    expect("expect(await page.evaluate(() => (window as any).__wasDisabled), 'disabled while the save is in flight').toBe(true);").toMatch(FLAG_ASSERTED);
    expect('(window as any).__saved = null; (window as any).__wasDisabled = null;').not.toMatch(FLAG_ASSERTED);
  });

  it.each(specs.map(s => s.name))('%s never reads #cert.disabled from outside the fake save', name => {
    const raw = specs.find(s => s.name === name)!.text;
    const lines = code(raw).split('\n');
    // A statement can wrap, so judge each read by the line it is on and the one before it.
    const hits = lines.flatMap((l, i) => (POLLED_DISABLED.test(l) && (CERT_LOCATOR.test(l) || CERT_LOCATOR.test(lines[i - 1] ?? '')) ? [`${name}:${realLine(raw, l)}`] : []));
    expect(hits, 'read #cert.disabled inside the fake save and assert that flag — a polled toBeDisabled() races the fake delay (#1797)').toEqual([]);
  });

  it('both certificate tests still assert the flag the fake save captured', () => {
    // game.spec.ts (the mission results) and duel.spec.ts (the duel end) — the two `#cert` handlers in `src/ui`.
    // One fewer is a test that stopped checking the disable at all, which is the gap #603 and #409 item 2 closed.
    for (const name of ['game.spec.ts', 'duel.spec.ts']) {
      const src = code(specs.find(s => s.name === name)!.text);
      expect(src, `${name} asserts __wasDisabled is true`).toMatch(FLAG_ASSERTED);
    }
  });
});

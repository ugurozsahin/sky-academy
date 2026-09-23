import { expect, type Page } from '@playwright/test';

/**
 * Shared viewport assertions for the tablet projects (#116).
 *
 * Nothing in CI had ever rendered a tablet before this file: `playwright.config.ts` had `mobile`
 * (iPhone 13, 390x844) and `desktop` (1280x800, no touch), and a portrait tablet is neither — ~800 px
 * wide, so it crosses every `min-width: 600px` breakpoint the desktop layout uses, but tall and
 * touch-driven like the phone. Three bugs from one playtest (#107, #109, #110) share that blind spot.
 *
 * The assertions live here rather than in a spec so that #107, #109 and #110 each add their own
 * screen-specific checks on top instead of writing a fourth copy of the measurement.
 */

/** One element that paints outside the viewport, named well enough to find in the DOM. */
export type Overflow = { sel: string; left: number; right: number; width: number };

/**
 * Every visible element inside `#app` whose border box sticks out past the left or right edge.
 *
 * Two exclusions, both deliberate:
 *   - an element with a clipping ancestor (`overflow-x` other than `visible`) is not overflowing the
 *     page — it is being clipped, which is what the clip is for, and the arena's own canvas relies on it;
 *   - an element that paints nothing (display/visibility/opacity, or a zero-area box) cannot be seen
 *     sticking out, and the sky decorations are full of those.
 * Anything else that reaches past the edge is a child unable to see part of the screen, which is exactly
 * what #109 and #110 are.
 */
export async function horizontalOverflow(page: Page, tolerance = 1): Promise<Overflow[]> {
  return page.evaluate(t => {
    const name = (el: Element) => el.tagName.toLowerCase() +
      (el.id ? `#${el.id}` : '') + (el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).join('.')}` : '');
    const vw = document.documentElement.clientWidth;
    const out: { sel: string; left: number; right: number; width: number }[] = [];
    for (const el of Array.from(document.querySelectorAll('#app *'))) {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (r.right <= vw + t && r.left >= -t) continue;
      let clipped = false;
      for (let p = el.parentElement; p; p = p.parentElement)
        if (getComputedStyle(p).overflowX !== 'visible') { clipped = true; break; }
      if (clipped) continue;
      out.push({ sel: name(el), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) });
    }
    return out;
  }, tolerance);
}

/**
 * The screen fits the viewport across: the page does not scroll sideways, and nothing paints off either
 * edge. `where` names the screen so a failure says which one rather than just printing a box.
 */
export async function expectFitsViewport(page: Page, where: string, tolerance = 1) {
  const scroll = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scroll.scrollWidth, `${where}: the page scrolls sideways (${scroll.scrollWidth} > ${scroll.clientWidth})`)
    .toBeLessThanOrEqual(scroll.clientWidth + tolerance);
  expect(await horizontalOverflow(page, tolerance), `${where}: something paints outside the viewport`).toEqual([]);
}

/**
 * Every `child` box sits inside the `parent` box it belongs to — the containment #107 is about, kept
 * general because #109's dashboard tiles need the same measurement.
 *
 * Pairs are matched by DOM ancestry, not by index: `containedIn(page, '.slot', '.obj')` measures each
 * `.obj` against the `.slot` that contains it, so a missing or extra slot fails loudly instead of
 * silently comparing the wrong two boxes.
 */
/**
 * Overrides the four `safe-area-inset-*` env() values via CDP (#399's own item 4). A Playwright page has no
 * notch, so `env(safe-area-inset-*)` always resolves to its fallback under either project — which is why
 * #399's `--sal`/`--sar` rails in `tests/unit/guardrails.test.ts` are text-only (grepping the CSS, not
 * rendering it), and stayed that way through three merged slices (#530, #542, #551). Chromium exposes
 * `Emulation.setSafeAreaInsetsOverride` over CDP; Playwright does not wrap it, so this opens the session
 * directly. Confirmed against the bundled 141.0.7390.37 build the override takes effect on the CURRENT
 * document with no reload — style is invalidated immediately, the same way a DevTools-panel edit would be.
 */
export async function overrideSafeAreaInsets(
  page: Page,
  insets: { top?: number; right?: number; bottom?: number; left?: number },
) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets });
}

export async function outsideItsBox(page: Page, parentSel: string, childSel: string, tolerance = 0.5) {
  return page.evaluate(([p, c, t]) => {
    const out: { i: number; over: Record<string, number> }[] = [];
    const parents = Array.from(document.querySelectorAll(p as string));
    parents.forEach((parent, i) => {
      const child = parent.querySelector(c as string);
      if (!child) return;                       // an empty slot is a slot with nothing to overflow it
      const a = parent.getBoundingClientRect(), b = child.getBoundingClientRect();
      const over = {
        left: Math.round((a.left - b.left) * 10) / 10,
        right: Math.round((b.right - a.right) * 10) / 10,
        top: Math.round((a.top - b.top) * 10) / 10,
        bottom: Math.round((b.bottom - a.bottom) * 10) / 10,
      };
      if (Object.values(over).some(v => v > (t as number))) out.push({ i, over });
    });
    return out;
  }, [parentSel, childSel, tolerance] as const);
}

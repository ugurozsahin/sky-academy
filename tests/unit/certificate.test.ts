import { afterEach, describe, it, expect } from 'vitest';
import { certAlbumHTML, certificateText, certRoute, deliverCertificate, isNativeShell } from '../../src/ui/certificate';
import { AVATARS } from '../../src/avatars';
import type { StoredCert } from '../../src/storage';

const base = { name: 'Ada', avatar: AVATARS[0], year: 'Year 1', title: 'Number Bonds', stars: 3, score: 340, correct: 30, attempts: 30, date: new Date('2026-09-06T10:00:00Z') };

const storedCert = (o: Partial<StoredCert> = {}): StoredCert =>
  ({ id: 'year1:number-bonds', name: 'Ada', avatar: AVATARS[0].id, year: 'Year 1', title: 'Number Bonds', stars: 3, score: 340, correct: 30, attempts: 30, date: '2026-09-06', ...o });

describe('certAlbumHTML ("My certificates", #110)', () => {
  it('shows an empty-state hint, with no cert-list, when nothing has been earned', () => {
    const h = certAlbumHTML([]);
    expect(h).toContain('cert-empty');
    expect(h).not.toContain('cert-list');
  });
  it('renders one row per certificate, carrying its id for the View button', () => {
    const h = certAlbumHTML([storedCert(), storedCert({ id: 'year1:writing', title: 'Rhyming Words', stars: 1 })]);
    expect((h.match(/class="cert-row"/g) ?? []).length).toBe(2);
    expect(h).toContain('data-id="year1:number-bonds"');
    expect(h).toContain('data-id="year1:writing"');
    expect(h).toContain('Number Bonds');
    expect(h).toContain('Rhyming Words');
  });
  it('clamps the star rating into a 3-glyph row and formats a British long-ish date', () => {
    const h = certAlbumHTML([storedCert({ stars: 5 })]);
    expect(h).toContain('★★★');
    expect(h).not.toContain('★★★★');
    expect(h).toContain('6 Sept 2026');
  });
  it('escapes a hand-edited title/year rather than injecting markup', () => {
    const h = certAlbumHTML([storedCert({ title: '<img onerror=alert(1)>', year: '"><script>' })]);
    expect(h).not.toContain('<img onerror');
    expect(h).not.toContain('<script>');
  });
  it('tolerates an unparsable date instead of printing "Invalid Date"', () => {
    const h = certAlbumHTML([storedCert({ date: 'not-a-date' })]);
    expect(h).not.toContain('Invalid Date');
  });
});

describe('mission certificate text', () => {
  it('names the child, the mission, the island, the stars and a British long date', () => {
    const t = certificateText(base);
    expect(t.heading).toBe('Sky Ninja Academy'); expect(t.child).toBe('Ada');
    expect(t.reason).toBe('completed the Number Bonds mission on Year 1 Island');
    expect(t.detail).toBe('30/30 correct (100%) · score 340');
    expect(t.stars).toBe('★★★'); expect(t.date).toBe('6 September 2026');
    expect(t.signed).toContain('Volt');
  });
  it('falls back to "Ninja" for a blank name, clamps stars, and words Sensei training differently', () => {
    const t = certificateText({ ...base, name: '  ', stars: 5, correct: 21, attempts: 25, training: true });
    expect(t.child).toBe('Ninja'); expect(t.stars).toBe('★★★');
    expect(t.reason).toBe('completed Sensei training on Year 1 Island');
    expect(t.detail).toBe('21/25 correct (84%) · score 340');
    expect(certificateText({ ...base, stars: 1, attempts: 0, correct: 0 }).stars).toBe('★☆☆');
    expect(certificateText({ ...base, stars: 1, attempts: 0, correct: 0 }).detail).toContain('(0%)');
  });
});

const caps = (o: Partial<Parameters<typeof certRoute>[0]> = {}) =>
  ({ canShareFiles: false, claudeSave: false, claudeRuntime: false, nativeShell: false, ...o });

describe('certificate delivery route', () => {
  it('prefers the system share sheet when files can be shared', () => {
    expect(certRoute(caps({ canShareFiles: true, claudeSave: true, claudeRuntime: true }))).toBe('share');
    expect(certRoute(caps({ canShareFiles: true }))).toBe('share');
  });
  it('uses the artifact save prompt when downloads are granted and sharing is unavailable', () => {
    expect(certRoute(caps({ claudeSave: true, claudeRuntime: true }))).toBe('save');
  });
  it('falls back to the full-screen view inside the artifact viewer without a downloads grant', () => {
    expect(certRoute(caps({ claudeRuntime: true }))).toBe('show');
  });
  it('uses a plain download in the static / PWA build with no artifact runtime', () => {
    expect(certRoute(caps())).toBe('download');
  });

  // #205 — the owner pressed the certificate button on the Android tablet and nothing happened at all.
  // The Capacitor WebView has no share-with-files and no artifact runtime, so the route fell through to
  // `<a download>`, and a stock Android WebView has no download handler: `a.click()` is swallowed in
  // silence. `deliverCertificate` promises it "never silently does nothing", and this is where it lied.
  describe('inside the Android APK WebView (#205)', () => {
    it('shows the certificate rather than a download the WebView will swallow', () => {
      expect(certRoute(caps({ nativeShell: true }))).toBe('show');
    });
    it('still prefers a real share sheet or save prompt when the WebView offers one', () => {
      expect(certRoute(caps({ nativeShell: true, canShareFiles: true }))).toBe('share');
      expect(certRoute(caps({ nativeShell: true, claudeSave: true }))).toBe('save');
    });
    // The contract, stated as a property rather than as four examples: whatever else is true, a runtime
    // that cannot honour `<a download>` is never sent to it. This is the assertion that has to stay green
    // when the Capacitor share/filesystem route of #205 is added ahead of `download`.
    it('never resolves to a download on a native shell, for any combination of the other capabilities', () => {
      for (const canShareFiles of [true, false])
        for (const claudeSave of [true, false])
          for (const claudeRuntime of [true, false]) {
            const r = certRoute({ canShareFiles, claudeSave, claudeRuntime, nativeShell: true });
            expect(r, `share=${canShareFiles} save=${claudeSave} runtime=${claudeRuntime}`).not.toBe('download');
          }
    });
  });
});

describe('native shell detection (#205)', () => {
  const win = (Capacitor: unknown) => ({ Capacitor }) as unknown as Window & typeof globalThis;

  it('is false in an ordinary browser, where there is no Capacitor global', () => {
    expect(isNativeShell(win(undefined))).toBe(false);
  });
  it('asks isNativePlatform() when Capacitor provides it', () => {
    expect(isNativeShell(win({ isNativePlatform: () => true }))).toBe(true);
    expect(isNativeShell(win({ isNativePlatform: () => false }))).toBe(false);
  });

  // `getPlatform` is the OTHER accessor the shipped bridge really sets — checked in
  // node_modules/@capacitor/android/.../native-bridge.js, which defines `cap.getPlatform` and
  // `cap.isNativePlatform` and no `cap.platform`. A bump that renamed or dropped `isNativePlatform`
  // leaves this shape, and the previous version answered `false` for it: the swallowed download, back.
  it('reads getPlatform too — the realistic shape after a Capacitor bump', () => {
    expect(isNativeShell(win({ getPlatform: () => 'android' }))).toBe(true);
    expect(isNativeShell(win({ getPlatform: () => 'ios' }))).toBe(true);
    expect(isNativeShell(win({ getPlatform: () => 'web' }))).toBe(false);
  });

  // The half-started bridge. `isNativePlatform` exists and answers uselessly, so deciding on *which
  // accessor is present* took the first branch and returned `undefined` — falsy — from a function
  // declared `boolean`, and tsc was silent because the cast asserts the shape. Decide on the answer.
  it('a method that answers nothing does not veto the others', () => {
    expect(isNativeShell(win({ isNativePlatform: () => undefined, getPlatform: () => 'android' }))).toBe(true);
    expect(isNativeShell(win({ isNativePlatform: () => undefined, platform: 'android' }))).toBe(true);
  });

  // Says nothing at all. This now answers `true`, where it used to answer `false` "rather than guessing
  // native" — which disagreed with the catch block three lines below it, arguing the opposite for the
  // same situation. One rule: a Capacitor global that names no platform is treated as the shell, because
  // a browser wrongly shown its certificate has still seen it, and a WebView wrongly sent to
  // `<a download>` has a dead button. Only an explicit `false`/`'web'` overrides that.
  it('treats a Capacitor global that says nothing as the shell, like the catch does', () => {
    expect(isNativeShell(win({}))).toBe(true);
  });

  // The accessors CAN disagree, and the shipped bridge only ever disagrees one way: `isNativePlatform` is
  // a constant `() => true`, while `getPlatform()` re-derives from `win.androidBridge` per call and says
  // 'web' when that is not on the window yet. A veto rule ("any 'web' means browser") read that
  // half-started Android shell as a browser and sent it to the download the WebView swallows — #205, on
  // the one runtime this code exists for. Worse, it made a bridge that SAYS it is native score lower than
  // `{}`, which says nothing. A definite yes wins.
  it('a positive answer is not overruled by a second accessor saying web', () => {
    expect(isNativeShell(win({ isNativePlatform: () => true, getPlatform: () => 'web' })),
      'the half-started Android shell: native, whatever getPlatform() has caught up to').toBe(true);
    expect(isNativeShell(win({ isNativePlatform: () => true, getPlatform: () => 'android' }))).toBe(true);
    expect(isNativeShell(win({ getPlatform: () => 'android', platform: 'web' }))).toBe(true);
  });

  // The other direction must not move: Capacitor's own *web* platform says `isNativePlatform() === false`,
  // and it downloads like any browser. Nothing above may promote it.
  it('still says no when the bridge actually says no', () => {
    expect(isNativeShell(win({ isNativePlatform: () => false, getPlatform: () => 'web' }))).toBe(false);
    expect(isNativeShell(win({ isNativePlatform: () => false }))).toBe(false);
    expect(isNativeShell(win({ platform: 'web' })), 'the third signal has to veto too, or it is decoration').toBe(false);
  });

  it('an exploding bridge is caught, including a throwing getter on the global itself', () => {
    expect(isNativeShell(win({ isNativePlatform: () => { throw new Error('bridge not ready'); } }))).toBe(true);
    const w = {} as Record<string, unknown>;
    Object.defineProperty(w, 'Capacitor', { get() { throw new Error('polyfill'); } });
    expect(isNativeShell(w as never), 'the read is inside the try, or this throws into play.ts').toBe(true);
  });
});

/*
 * `deliverCertificate` itself, driven end to end (#205).
 *
 * The route function and the detector above are pure and well covered, and neither is where the bug was.
 * #205 lived in the WIRING: a fallback consulting a capability nobody had computed. Until this block
 * existed, nothing in the suite ever CALLED `deliverCertificate`, so that wiring was held only by text
 * rails over the source — and these mutations reproduced #205 with the whole suite green and tsc clean:
 * severing the detector (`const nativeShell = false`), the same severing behind a helper, dropping the
 * call to `lastResort()`, and — found a round later — `showCertificateFullscreen;` without its call, plus
 * the two spellings of that which keep the call but never reach it (`void view;`, a never-true `if`).
 *
 * The division of labour, stated correctly because an earlier version of this comment had it backwards:
 * inlining the anchor instead of calling `triggerDownload` is caught by the RAILS, not here — the
 * one-call-site rail fails at zero occurrences as readily as at two. What only running the thing can
 * catch is the mutation that keeps every identifier the rails read and changes what happens: a call
 * turned into a bare reference, a guard that never fires, a detector wired to a constant.
 *
 * There is no jsdom here (it is not a dependency and the unit run must stay browserless), so the globals
 * are stubbed the way `tests/unit/sim/harness.ts` does it, and restored in `afterEach`.
 */
interface FakeEl { tagName: string; className: string; src: string; download?: string; href?: string; clicked: number; children: FakeEl[] }

function stubBrowser(o: { capacitor?: unknown; canShareFiles?: boolean; shareRejects?: boolean; claude?: unknown } = {}) {
  const created: FakeEl[] = [];
  const make = (tag: string): FakeEl => {
    const e = {
      tagName: tag, clicked: 0, children: [] as FakeEl[], className: '', alt: '', src: '', textContent: '',
      setAttribute() {}, addEventListener() {}, removeEventListener() {}, remove() {},
      append(...k: FakeEl[]) { e.children.push(...k); }, appendChild(k: FakeEl) { e.children.push(k); },
      click() { e.clicked++; },
    } as unknown as FakeEl;
    created.push(e);
    return e;
  };
  const g = globalThis as unknown as Record<string, unknown>;
  const saved = {
    window: g.window, document: g.document, Image: g.Image, URL: g.URL,
    // `navigator` is an accessor on the Node global, so a plain assignment throws "has only a getter".
    // It is put back by descriptor for the same reason — deleting it would not restore the real one.
    navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'),
  };
  const body = make('body');
  g.document = { createElement: make, querySelector: () => null, body };
  g.window = { claude: o.claude, Capacitor: o.capacitor };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      canShare: () => !!o.canShareFiles,
      share: () => (o.shareRejects ? Promise.reject(new Error('cancelled')) : Promise.resolve()),
    },
  });
  g.Image = function Image(this: FakeEl) { return make('img'); } as unknown as typeof globalThis.Image;
  g.URL = { createObjectURL: () => 'blob:fake', revokeObjectURL: () => {} };
  return {
    created,
    /** Did anything actually get clicked as an `<a download>`? That is the swallowed no-op, made visible. */
    downloadClicks: () => created.filter(e => e.tagName === 'a' && e.clicked > 0).length,
    /**
     * Did the child actually get shown the certificate?
     *
     * This used to be `body.children.length > 0`, which is *also* true on the download path, because
     * `triggerDownload` appends its `<a>` to the body and the stub's `remove()` is a no-op. It happened
     * to discriminate at its one call site by luck, so it could not carry the assertion below. Look for
     * the thing it is named after instead: the `.cert-view` dialog, holding an image with a real src.
     */
    shownFullscreen: () => created.some(e =>
      e.className === 'cert-view' && e.children.some(k => k.tagName === 'img' && !!k.src)),
    restore() {
      g.window = saved.window;
      g.document = saved.document;
      g.Image = saved.Image;
      g.URL = saved.URL;
      if (saved.navigator) Object.defineProperty(globalThis, 'navigator', saved.navigator);
    },
  };
}

/** A canvas stub with only what `deliverCertificate` and the full-screen view actually read back. */
const fakeCanvas = () => ({
  toBlob: (cb: (b: Blob | null) => void) => cb(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })),
  toDataURL: () => 'data:image/png;base64,AAA',
}) as unknown as HTMLCanvasElement;

describe('deliverCertificate, actually run (#205)', () => {
  let dom: ReturnType<typeof stubBrowser> | null = null;
  afterEach(() => { dom?.restore(); dom = null; });

  it('shows the certificate in the Android WebView instead of a download it would swallow', async () => {
    dom = stubBrowser({ capacitor: { isNativePlatform: () => true } });
    const how = await deliverCertificate(fakeCanvas(), 'cert.png');
    expect(how, 'the tablet must get a visible outcome, never a silent <a download>').toBe('shown');
    expect(dom.downloadClicks(), 'no <a download> may be clicked on a runtime that swallows it').toBe(0);
    expect(dom.shownFullscreen(), 'the full-screen view is what the child actually sees').toBe(true);
  });

  // The live path for the guard inside `lastResort()`: certRoute never answers 'download' for a native
  // shell, so the ONLY caller that can reach that guard is the share that was offered and cancelled.
  // This is the exact path the first version of the fix stepped straight past into triggerDownload.
  it('a cancelled share in the WebView steps down to the view, not to a download', async () => {
    dom = stubBrowser({ capacitor: { getPlatform: () => 'android' }, canShareFiles: true, shareRejects: true });
    const how = await deliverCertificate(fakeCanvas(), 'cert.png');
    expect(how).toBe('shown');
    expect(dom.downloadClicks(), 'the cancelled-share step-down is where this broke the first time').toBe(0);
    // The positive half, which this scenario's title promised and did not check. Without it, dropping the
    // CALL and keeping the identifier — `showCertificateFullscreen; return 'shown';` — is tsc-clean and
    // leaves the whole suite green, while on the tablet the child cancels the share and nothing appears:
    // #205 back, word for word, inside the guard written to prevent it. "No anchor was clicked" is not
    // "the child saw something", and only one of those is what this test is named after.
    expect(dom.shownFullscreen(), 'and the child must actually SEE the certificate').toBe(true);
  });

  it('still downloads in an ordinary browser, so the fix did not take the feature away', async () => {
    dom = stubBrowser();
    const how = await deliverCertificate(fakeCanvas(), 'cert.png');
    expect(how).toBe('downloaded');
    expect(dom.downloadClicks(), 'a real browser honours <a download>, so it must still be used').toBe(1);
  });

  // The browser half of the same step-down, and it is the one that pins the `lastResort()` CALL rather
  // than its body. Dropping the call (`lastResort;`) leaves both text rails matching and every other
  // scenario here green: the share case then falls through into `case 'save'`, `saveViaClaude(null)`
  // throws, and its catch-all shows the certificate — so the native scenarios still see 'shown' and no
  // download, and only a browser that expected its download notices anything went wrong.
  it('a cancelled share in an ordinary browser steps down to the download, not to the view', async () => {
    dom = stubBrowser({ canShareFiles: true, shareRejects: true });
    const how = await deliverCertificate(fakeCanvas(), 'cert.png');
    expect(how, 'cancelling a share in a browser must still leave the child with the file').toBe('downloaded');
    expect(dom.downloadClicks()).toBe(1);
  });

  it('a Capacitor bridge that throws is treated as native, not as a browser', async () => {
    dom = stubBrowser({ capacitor: { isNativePlatform: () => { throw new Error('bridge not ready'); } } });
    const how = await deliverCertificate(fakeCanvas(), 'cert.png');
    expect(how, 'a half-started bridge must not resolve to the swallowed download').toBe('shown');
    expect(dom.downloadClicks()).toBe(0);
  });
});

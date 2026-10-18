// Browser stubs for driving `deliverCertificate` in Node, with no jsdom (#205, #1943).
interface FakeEl { tagName: string; className: string; src: string; download?: string; href?: string; clicked: number; children: FakeEl[] }

export function stubBrowser(o: { capacitor?: unknown; canShareFiles?: boolean; shareRejects?: boolean; claude?: unknown } = {}) {
  const created: FakeEl[] = [];
  let shareCalls = 0;
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
      share: () => (shareCalls++, o.shareRejects ? Promise.reject(new Error('cancelled')) : Promise.resolve()),
    },
  });
  g.Image = function Image(this: FakeEl) { return make('img'); } as unknown as typeof globalThis.Image;
  g.URL = { createObjectURL: () => 'blob:fake', revokeObjectURL: () => {} };
  return {
    created,
    shareCalls: () => shareCalls,
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
export const fakeCanvas = () => ({
  toBlob: (cb: (b: Blob | null) => void) => cb(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })),
  toDataURL: () => 'data:image/png;base64,AAA',
}) as unknown as HTMLCanvasElement;

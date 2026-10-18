import { afterEach, describe, it, expect } from 'vitest';
import { deliverCertificate } from '../../src/ui/certificate';
import { fakeCanvas, stubBrowser } from './helpers/cert-browser';

const OPEN = () => Promise.resolve(true);   // a caller whose grown-ups gate lets the share through

describe('deliverCertificate keeps the share sheet behind the grown-ups gate (#1943)', () => {
  let dom: ReturnType<typeof stubBrowser> | null = null;
  afterEach(() => { dom?.restore(); dom = null; });
  const capacitorShare = (shared: unknown[]) => ({
    isNativePlatform: () => true,
    Plugins: {
      Filesystem: { writeFile: () => Promise.resolve({ uri: 'file:///cache/cert.png' }) },
      Share: { share: (o: unknown) => { shared.push(o); return Promise.resolve(); } },
    },
  });

  it('a caller that passes no gate never reaches Web Share', async () => {
    dom = stubBrowser({ canShareFiles: true });
    const how = await deliverCertificate(fakeCanvas(), 'cert.png');
    expect(dom.shareCalls(), 'the child must not reach the system share sheet').toBe(0);
    expect(how).toBe('downloaded');
  });

  it('a caller that passes no gate never reaches the Capacitor share sheet', async () => {
    const shared: unknown[] = [];
    dom = stubBrowser({ capacitor: capacitorShare(shared) });
    const how = await deliverCertificate(fakeCanvas(), 'cert.png');
    expect(shared, 'the Android share sheet is the other way out of the app').toEqual([]);
    expect(how, 'the child still gets the certificate').toBe('shown');
    expect(dom.shownFullscreen()).toBe(true);
  });

  it('a gate that says no steps down to save, and says nothing of sharing', async () => {
    dom = stubBrowser({ canShareFiles: true });
    const how = await deliverCertificate(fakeCanvas(), 'cert.png', () => Promise.resolve(false));
    expect(dom.shareCalls()).toBe(0);
    expect(how).toBe('downloaded');
  });

  it('a gate that says yes shares, and is asked once', async () => {
    dom = stubBrowser({ canShareFiles: true });
    let asked = 0;
    const how = await deliverCertificate(fakeCanvas(), 'cert.png', () => (asked++, Promise.resolve(true)));
    expect(how).toBe('shared');
    expect(dom.shareCalls()).toBe(1);
    expect(asked).toBe(1);
  });

  it('the gate is not asked where there is no share sheet to protect', async () => {
    dom = stubBrowser({});
    let asked = 0;
    await deliverCertificate(fakeCanvas(), 'cert.png', () => (asked++, Promise.resolve(true)));
    expect(asked, 'a plain download needs no grown-up').toBe(0);
  });

  it('the Capacitor share sheet opens once the gate says yes', async () => {
    const shared: unknown[] = [];
    dom = stubBrowser({ capacitor: capacitorShare(shared) });
    expect(await deliverCertificate(fakeCanvas(), 'cert.png', OPEN)).toBe('shared');
    expect(shared).toHaveLength(1);
  });
});

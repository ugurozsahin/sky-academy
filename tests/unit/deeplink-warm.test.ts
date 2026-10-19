// #2041: handleDeepLink's warm-start decision — go, keep or drop — and stripLinkParams reporting a refused replaceState.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleDeepLink, stripLinkParams, takeLink, wireDeepLinks, type LinkGate } from '../../src/deeplink-open';

const LINK = '/play/?year=reception';
const wire = (g: LinkGate) => { const restart = vi.fn(); wireDeepLinks(restart, () => g); return restart; };

describe('handleDeepLink (#2041)', () => {
  afterEach(() => { takeLink(); vi.unstubAllGlobals(); });

  it('go: re-runs the boot decision and leaves the link for the map to take', () => {
    const restart = wire('go');
    handleDeepLink(LINK);
    expect(restart).toHaveBeenCalledOnce();
    expect(takeLink()?.year.id).toBe('reception');
  });

  it('keep: no reroute, the link waits for the next map (a child still onboarding)', () => {
    const restart = wire('keep');
    handleDeepLink(LINK);
    expect(restart).not.toHaveBeenCalled();
    expect(takeLink()?.year.id).toBe('reception');
  });

  it('drop: no reroute and nothing left pending, so the link never opens unprompted later', () => {
    const restart = wire('drop');
    handleDeepLink(LINK);
    expect(restart).not.toHaveBeenCalled();
    expect(takeLink()).toBeNull();
  });

  it('an unknown link neither reroutes nor leaves anything pending', () => {
    const restart = wire('go');
    handleDeepLink('/play/?topic=nope');
    expect(restart).not.toHaveBeenCalled();
    expect(takeLink()).toBeNull();
  });
});

describe('stripLinkParams (#2041)', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('says false when replaceState is refused, true when it works', () => {
    const history = { state: null, replaceState: vi.fn() };
    vi.stubGlobal('location', { href: 'https://x.test/?topic=a&fast=2' });
    vi.stubGlobal('history', history);
    expect(stripLinkParams()).toBe(true);
    expect(history.replaceState).toHaveBeenCalledWith(null, '', '/?fast=2');
    history.replaceState.mockImplementation(() => { throw new Error('denied'); });
    expect(stripLinkParams()).toBe(false);
  });
});

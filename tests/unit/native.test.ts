import { describe, expect, it, vi } from 'vitest';
import { plugin, wireBackButton } from '../../src/native';

/** A fake bridge shaped like the injected Capacitor global, with an optional set of registered plugins. */
const bridge = (Plugins?: Record<string, unknown>) =>
  ({ Capacitor: Plugins === undefined ? undefined : { Plugins } }) as unknown as Window & typeof globalThis;

describe('plugin (#110, moved from ui/certificate.ts by #699)', () => {
  it('is undefined with no bridge at all, or a bridge with no such plugin registered', () => {
    expect(plugin('App', bridge())).toBeUndefined();
    expect(plugin('App', bridge({}))).toBeUndefined();
  });

  it('returns the plugin once it has registered', () => {
    const App = { minimizeApp: () => {} };
    expect(plugin('App', bridge({ App }))).toBe(App);
  });

  it('does not throw on a throwing accessor', () => {
    const w = { Capacitor: { get Plugins() { throw new Error('bridge not ready'); } } } as unknown as Window & typeof globalThis;
    expect(plugin('App', w)).toBeUndefined();
  });
});

/**
 * `wireBackButton` (#699): the three cases the issue's own acceptance criteria name, each proved without a
 * device by passing `bridge`/`history`/`minimize` in rather than reading the real globals.
 */
describe('wireBackButton (#699)', () => {
  it('registers nothing when the bridge has no App plugin — a browser, the PWA, or a sync that failed', () => {
    const history = { state: { screen: 'island' }, back: vi.fn() };
    const minimize = vi.fn();
    expect(() => wireBackButton({ bridge: bridge(), history, minimize })).not.toThrow();
    expect(() => wireBackButton({ bridge: bridge({}), history, minimize })).not.toThrow();
    // Nor when the plugin object exists but is missing addListener — a malformed or half-synced bridge.
    expect(() => wireBackButton({ bridge: bridge({ App: {} }), history, minimize })).not.toThrow();
    expect(history.back).not.toHaveBeenCalled();
    expect(minimize).not.toHaveBeenCalled();
  });

  it('steps back through the ordinary history stack when a screen is on it', () => {
    let onBack!: () => void;
    const App = { addListener: (event: string, cb: () => void) => { if (event === 'backButton') onBack = cb; } };
    const history = { state: { screen: 'play' }, back: vi.fn() };
    const minimize = vi.fn();
    wireBackButton({ bridge: bridge({ App }), history, minimize });
    onBack();
    expect(history.back).toHaveBeenCalledOnce();
    expect(minimize).not.toHaveBeenCalled();
  });

  it('backgrounds the app instead, at the root, where there is no screen on the stack', () => {
    let onBack!: () => void;
    const App = { addListener: (event: string, cb: () => void) => { if (event === 'backButton') onBack = cb; } };
    const history = { state: null as unknown, back: vi.fn() };
    const minimize = vi.fn();
    wireBackButton({ bridge: bridge({ App }), history, minimize });
    onBack();
    expect(minimize).toHaveBeenCalledOnce();
    expect(history.back).not.toHaveBeenCalled();
  });

  // silent-failure-hunter, round 1: a throw here runs from a native callback with nothing above it in the
  // call stack to report it — a back press must degrade gracefully, never crash the app it is leaving.
  it('a throwing minimize (or history.back) does not escape the registered listener', () => {
    let onBack!: () => void;
    const App = { addListener: (event: string, cb: () => void) => { if (event === 'backButton') onBack = cb; } };
    const boom = () => { throw new Error('native call failed'); };
    wireBackButton({ bridge: bridge({ App }), history: { state: null, back: vi.fn() }, minimize: boom });
    expect(onBack).not.toThrow();
    wireBackButton({ bridge: bridge({ App }), history: { state: { screen: 'play' }, back: boom }, minimize: vi.fn() });
    expect(onBack).not.toThrow();
  });
});

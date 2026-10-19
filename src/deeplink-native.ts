// #2028: the Android half of deep links. The OS hands the app an https://sharpwise.co.uk/play/… URL (App Links,
// autoVerify in AndroidManifest.xml); `@capacitor/app` reports it as `appUrlOpen` (warm) or `getLaunchUrl` (cold).
// The plugin is read off the injected bridge (`plugin()` in native.ts), so the web build never loads it.
import { isNativeShell, plugin } from './native';

export const APP_LINK_HOST = 'sharpwise.co.uk';

/** Only our own verified host, over https, under /play/. Anything else (foreign host, javascript:, http:) is ignored. */
export function isAppLink(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === APP_LINK_HOST && !u.port && !u.username && !u.password
      && (u.pathname === '/play' || u.pathname.startsWith('/play/'));
  } catch { return false; }
}

interface LinkApp {
  addListener(event: 'appUrlOpen', cb: (e: { url?: unknown }) => void): unknown;
  getLaunchUrl?(): Promise<{ url?: unknown } | undefined>;
}

/** `open` is `handleDeepLink`: warm start (`appUrlOpen`) and cold start (`getLaunchUrl`, which resolves after the first screen is drawn, so it too must re-run the boot decision). */
export function wireNativeLinks(env: {
  open: (url: string) => void;
  bridge?: Window & typeof globalThis;
  native?: boolean;
}): void {
  const w = env.bridge ?? window;
  if (!(env.native ?? isNativeShell(w))) return;
  const app = plugin<LinkApp>('App', w);
  if (!app || typeof app.addListener !== 'function') return;
  try {
    app.addListener('appUrlOpen', e => { try { if (isAppLink(e?.url)) env.open(e.url); } catch { /* a bad link never crashes the app */ } });
    app.getLaunchUrl?.().then(r => { if (isAppLink(r?.url)) env.open(r.url); }).catch(() => {});
  } catch { /* the plugin is optional: no link support is the web behaviour */ }
}

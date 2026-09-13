// Mission certificate: a printable PNG (landscape, 1200×850) drawn on an offscreen canvas, then shared
// (Web Share with files, e.g. iOS/Android) or downloaded. No DOM beyond the canvas; text is built by a pure helper.
import type { Avatar } from '../avatars';

export interface CertInfo { name: string; avatar: Avatar; year: string; title: string; stars: number; score: number; correct: number; attempts: number; date?: Date; training?: boolean }
export interface CertText { heading: string; awarded: string; child: string; reason: string; detail: string; stars: string; date: string; signed: string }

/** The words on the certificate (pure, unit-tested). */
export function certificateText(i: CertInfo): CertText {
  const d = i.date ?? new Date();
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const acc = i.attempts ? Math.round(100 * i.correct / i.attempts) : 0;
  return {
    heading: 'Sky Ninja Academy', awarded: 'Certificate of Achievement', child: i.name.trim() || 'Ninja',
    reason: i.training ? `completed Sensei training on ${i.year} Island` : `completed the ${i.title} mission on ${i.year} Island`,
    detail: `${i.correct}/${i.attempts} correct (${acc}%) · score ${i.score}`,
    stars: '★'.repeat(Math.max(0, Math.min(3, i.stars))) + '☆'.repeat(3 - Math.max(0, Math.min(3, i.stars))),
    date, signed: `Sensei · with ${i.avatar.name} the ${i.avatar.element}`,
  };
}

const loadImage = (src: string) => new Promise<HTMLImageElement | null>(res => { const img = new Image(); img.onload = () => res(img); img.onerror = () => res(null); img.src = src; });

export async function drawCertificate(i: CertInfo): Promise<HTMLCanvasElement> {
  const t = certificateText(i); const W = 1200, H = 850;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  try { await (document as any).fonts?.ready; } catch { /* fall back to system fonts */ }
  const font = (px: number, w = 700) => `${w} ${px}px Fredoka, "Baloo 2", Nunito, system-ui, sans-serif`;
  // sky background + soft clouds
  const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#5aa9ff'); sky.addColorStop(1, '#dff3ff'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
  g.fillStyle = '#ffffffb0'; for (const [x, y, r] of [[160, 700, 70], [230, 720, 90], [320, 705, 60], [900, 160, 60], [980, 140, 80], [1060, 165, 55]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  // parchment card
  g.fillStyle = '#fffdf5'; g.strokeStyle = i.avatar.glow; g.lineWidth = 10; roundRect(g, 50, 50, W - 100, H - 100, 36); g.fill(); g.stroke();
  g.strokeStyle = '#ffb020'; g.lineWidth = 3; roundRect(g, 72, 72, W - 144, H - 144, 26); g.stroke();
  // text column (left) + avatar (right)
  const img = await loadImage(i.avatar.img); const cx = 960, cy = 430;
  if (img) { g.save(); g.shadowColor = i.avatar.glow; g.shadowBlur = 40; const h = 460, w = h * img.width / img.height; g.drawImage(img, cx - w / 2, cy - h / 2, w, h); g.restore(); }
  g.textAlign = 'left'; g.textBaseline = 'alphabetic'; const x = 120;
  g.fillStyle = '#1a1f44'; g.font = font(34, 600); g.fillText(t.heading.toUpperCase(), x, 150);
  g.fillStyle = '#ff7a1a'; g.font = font(58); g.fillText(t.awarded, x, 225);
  g.fillStyle = '#4c5680'; g.font = font(28, 500); g.fillText('This certificate is proudly awarded to', x, 290);
  g.fillStyle = '#1a1f44'; g.font = font(fitSize(g, t.child, 96, 600, 700)); g.fillText(t.child, x, 395);
  g.fillStyle = '#4c5680'; g.font = font(30, 500); wrap(g, `who ${t.reason}`, x, 455, 600, 40);
  g.fillStyle = '#ffb020'; g.font = font(64); g.fillText(t.stars, x, 585);
  g.fillStyle = '#1a1f44'; g.font = font(30, 600); g.fillText(t.detail, x, 640);
  g.fillStyle = '#4c5680'; g.font = font(26, 500); g.fillText(t.date, x, 720);
  g.textAlign = 'right'; g.fillText(t.signed, W - 120, 720);
  return c;
}
function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function fitSize(g: CanvasRenderingContext2D, text: string, max: number, maxWidth: number, weight: number) { let px = max; for (; px > 36; px -= 4) { g.font = `${weight} ${px}px Fredoka, system-ui, sans-serif`; if (g.measureText(text).width <= maxWidth) break; } return px; }
function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lh: number) {
  let line = ''; for (const word of text.split(' ')) { const test = line ? `${line} ${word}` : word; if (g.measureText(test).width > maxWidth && line) { g.fillText(line, x, y); y += lh; line = word; } else line = test; }
  if (line) g.fillText(line, x, y);
}

/** How the certificate PNG reached the child (or was offered to them). */
export type CertRoute = 'share' | 'save' | 'show' | 'download';
export type CertOutcome = 'shared' | 'saved' | 'shown' | 'downloaded' | 'declined';

/**
 * Which delivery route to use, given what the runtime supports (pure, unit-tested).
 * Priority: the system share sheet (phones) → the artifact viewer's save prompt →
 * a full-screen "press & hold to save" view (artifact viewer with no downloads grant) →
 * a plain `<a download>` (static / PWA build, no artifact runtime).
 *
 * `nativeShell` is the Android APK's Capacitor WebView (#205). A stock Android WebView has no download
 * handler, so `a.click()` on an `<a download>` is swallowed without a word: the child presses the button
 * and nothing happens at all. `<a download>` is therefore never the last resort on a runtime that cannot
 * honour it — the full-screen view is, because press-and-hold on an image works there.
 */
export function certRoute(caps: { canShareFiles: boolean; claudeSave: boolean; claudeRuntime: boolean; nativeShell: boolean }): CertRoute {
  if (caps.canShareFiles) return 'share';
  if (caps.claudeSave) return 'save';
  if (caps.claudeRuntime) return 'show';
  if (caps.nativeShell) return 'show';
  return 'download';
}

/**
 * Are we inside the Android APK's Capacitor WebView? (#205)
 *
 * Capacitor injects a `Capacitor` global into the WebView, so this needs no import and no dependency —
 * `@capacitor/core` stays a devDependency of the build, never of the bundle.
 *
 * **One rule, on the answer rather than on which accessor exists.** An earlier version asked
 * `isNativePlatform()` and otherwise read `cap.platform`, described as "the older spelling". That was
 * simply wrong: the bridge this repository actually ships
 * (`node_modules/@capacitor/android/capacitor/src/main/assets/native-bridge.js`) sets `cap.getPlatform`
 * and `cap.isNativePlatform` and **no `cap.platform` at all**, so the fallback guarded a shape Capacitor
 * never produces, and a bump that renamed `isNativePlatform` would have restored the silent no-op the
 * comment claimed to prevent. Worse, `isNativePlatform: () => undefined` — a bridge mid-startup — took
 * the *first* branch and returned `undefined` from a function declared `boolean`.
 *
 * So: collect whatever the bridge answers, and treat native as the default unless something says
 * otherwise. The asymmetry is deliberate and is the same one the `catch` below argues for — a browser
 * wrongly shown the full-screen view has seen its certificate; a WebView wrongly sent to `<a download>`
 * has a button that does nothing, which is the bug.
 */
export function isNativeShell(w: Window & typeof globalThis = window): boolean {
  try {
    // The read is inside the `try` too: a getter-based polyfill — exactly the case the catch describes —
    // used to throw straight past this function and toast "Could not make the certificate" for one that
    // had drawn perfectly.
    const cap = (w as { Capacitor?: { isNativePlatform?: () => unknown; getPlatform?: () => unknown; platform?: unknown } }).Capacitor;
    if (!cap) return false;
    const answers = [
      typeof cap.isNativePlatform === 'function' ? cap.isNativePlatform() : undefined,
      typeof cap.getPlatform === 'function' ? cap.getPlatform() : undefined,
      cap.platform,                        // not in the shipped bridge; kept only for other embeddings
    ];
    // A definite YES wins outright, and it has to: the two accessors CAN disagree, and the shipped bridge
    // can only ever disagree in one direction. `isNativePlatform` is a hard-coded `() => true` in a file
    // that is injected on native only, while `getPlatform()` re-derives from `win.androidBridge` on every
    // call and answers 'web' whenever that interface is not on the window *at that moment* — Capacitor's
    // own code treats this as reachable, guarding `if (getPlatformId(win) === 'android')` before it
    // installs `postToNative`. So `[true, 'web']` is the half-started Android shell, and a veto rule read
    // it as a browser: the swallowed `<a download>` on exactly the runtime this exists for. It also made
    // the function absurd — a bridge SAYING it is native scored lower than one saying nothing at all.
    if (answers.some(a => a === true || (typeof a === 'string' && a !== 'web'))) return true;
    return !answers.some(a => a === false || a === 'web');
  } catch {
    return true;
  }
}

interface DownloadsApi { save(r: { filename: string; data: Blob }): Promise<{ status: string }> }

/** Resolve the artifact viewer's `downloads` capability, or null when this view can't run it. */
async function claudeDownloads(): Promise<DownloadsApi | null> {
  const claude = (window as { claude?: { use?(n: string): Promise<unknown> } }).claude;
  if (!claude?.use) return null;
  try {
    const api = await Promise.race([
      Promise.resolve(claude.use('downloads')),
      new Promise<null>(r => setTimeout(() => r(null), 8000)),   // a host that never answers resolves null itself; don't leave the child waiting on it
    ]);
    return (api && typeof (api as DownloadsApi).save === 'function') ? api as DownloadsApi : null;
  } catch { return null; }
}

/** Full-screen view of the certificate with a press-and-hold hint — the fallback where no save API works. */
export function showCertificateFullscreen(c: HTMLCanvasElement): void {
  document.querySelector('.cert-view')?.remove();
  const wrap = document.createElement('div'); wrap.className = 'cert-view'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-label', 'Your certificate');
  const img = new Image(); img.className = 'cert-view-img'; img.alt = 'Your Sky Ninja Academy certificate'; img.src = c.toDataURL('image/png');
  const hint = document.createElement('p'); hint.className = 'cert-view-hint'; hint.textContent = 'Press and hold the picture to save it 📥';
  const done = document.createElement('button'); done.className = 'btn big'; done.textContent = 'Done';
  const close = () => wrap.remove();
  done.addEventListener('click', close);
  wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
  wrap.append(img, hint, done);
  document.body.appendChild(wrap);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function saveViaClaude(dl: DownloadsApi, filename: string, blob: Blob, c: HTMLCanvasElement): Promise<CertOutcome> {
  try { await dl.save({ filename, data: blob }); return 'saved'; }
  catch (e) {
    if ((e as { code?: string })?.code === 'declined') return 'declined';   // the grown-up said no — a friendly toast, no error
    showCertificateFullscreen(c); return 'shown';                            // any other downloads error → the child can still save from the full-screen view
  }
}

/**
 * Get the certificate PNG to the child by the best route this runtime allows — it never silently does nothing.
 * Web Share (files) → artifact `downloads` save prompt → full-screen press-and-hold view → `<a download>`,
 * and on a native shell the full-screen view takes the last place instead, because that runtime swallows
 * `<a download>` silently (#205).
 */
export async function deliverCertificate(c: HTMLCanvasElement, filename: string): Promise<CertOutcome> {
  const blob = await new Promise<Blob | null>(res => c.toBlob(res, 'image/png'));
  if (!blob) throw new Error('certificate: could not encode PNG');
  const file = new File([blob], filename, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const canShareFiles = !!nav.canShare?.({ files: [file] });
  const claudeRuntime = !!(window as { claude?: unknown }).claude;
  const nativeShell = isNativeShell();
  const dl = claudeRuntime ? await claudeDownloads() : null;

  // The one place `<a download>` is chosen, so the runtime that cannot honour it is ruled out in one
  // place too. A cancelled share used to step down past this check straight to `triggerDownload`.
  const lastResort = (): CertOutcome => {
    if (nativeShell) { showCertificateFullscreen(c); return 'shown'; }
    triggerDownload(blob, filename); return 'downloaded';
  };

  switch (certRoute({ canShareFiles, claudeSave: !!dl, claudeRuntime, nativeShell })) {
    case 'share':
      try { await nav.share!({ files: [file], title: 'Sky Ninja Academy certificate' }); return 'shared'; }
      catch { /* cancelled → step down to the next best route */ }
      if (dl) return saveViaClaude(dl, filename, blob, c);
      if (claudeRuntime) { showCertificateFullscreen(c); return 'shown'; }
      return lastResort();
    case 'save':
      return saveViaClaude(dl!, filename, blob, c);
    case 'show':
      showCertificateFullscreen(c); return 'shown';
    default:
      return lastResort();
  }
}

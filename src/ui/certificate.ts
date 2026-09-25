// Mission certificate: a printable PNG (landscape, 1200×850) drawn on an offscreen canvas, then shared
// (Web Share with files, e.g. iOS/Android) or downloaded. No DOM beyond the canvas; text is built by a pure helper.
import { avatarById, type Avatar } from '../avatars';
import { esc } from './dom';
import { isNativeShell, plugin } from '../native';
import type { StoredCert } from '../storage';

export { isNativeShell };

// `date` is required, not defaulted (#410): the printed certificate and the album row it files alongside must
// read one fixed instant, decided once by the caller that earned it — a live `new Date()` default here would
// let `certificateText()` and `certToStored()` each read the clock at a different moment (or, before #410,
// read the same instant in two different calendars) and disagree about which day it is.
export interface CertInfo { name: string; avatar: Avatar; year: string; title: string; stars: number; score: number; correct: number; attempts: number; date: Date; training?: boolean; duel?: boolean }

/**
 * Which of the three things a certificate was earned for (#16 item 5). `training` and `duel` are separate
 * optional flags rather than one `kind` field because `training` is already **on disk** in every save that has
 * ever filed a certificate, and a discriminated union would need a `SAVE_VERSION` bump and a migration step to
 * earn nothing a reader can see. The cost is that `{ training: true, duel: true }` is expressible; no caller
 * constructs it (`play.ts` never sets `duel`, `ui/duel.ts` never sets `training`), and this function is the one
 * place the precedence is decided, so a hand-edited save reads as a duel rather than as undefined behaviour.
 *
 * Both flags are compared against `true` rather than read for truthiness, and that is the deliberate half:
 * `isCert()` does not type-check either one (it never did for `training`), so a hand-edited `"duel": "yes"`
 * reaches here. Falling back to `'mission'` prints a slightly wrong reason on a junk entry; **rejecting** the
 * entry in `isCert()` instead would drop a certificate a child genuinely earned, which is the worse of the two
 * and the opposite of what that guard exists for.
 */
export const certKind = (i: { training?: boolean; duel?: boolean }): 'duel' | 'sensei' | 'mission' =>
  i.duel === true ? 'duel' : i.training === true ? 'sensei' : 'mission';

/**
 * Rebuild a drawable certificate from what the save keeps (#205). Certificates are stored as data, not as a
 * PNG, so this is the only thing standing between the album and `drawCertificate()` — if a field ever goes
 * missing from `StoredCert`, this function stops compiling, which is the point of it existing now rather than
 * with the list screen.
 *
 * The date is read at local noon: `new Date('2026-09-14')` is UTC midnight, which `toLocaleDateString('en-GB')`
 * renders as the *previous* day anywhere west of Greenwich, so a child in the Americas would find yesterday's
 * date on this morning's certificate.
 */
export function certFromStored(c: StoredCert): CertInfo {
  return {
    name: c.name, avatar: avatarById(c.avatar), year: c.year, title: c.title,
    stars: c.stars, score: c.score, correct: c.correct, attempts: c.attempts,
    date: new Date(`${c.date}T12:00:00`), training: c.training, duel: c.duel,
  };
}
/**
 * The inverse of `certFromStored()`: the album entry for a certificate that has just been earned (#16 review,
 * B1). **`id` is the only thing the caller supplies** — every other field is read off the one `CertInfo` that
 * is also the object drawn, so the album entry and the child's keepsake cannot describe different things.
 *
 * It exists because fields were being written **twice, by hand**, on the duel path: once into the drawn
 * `CertInfo` and once into the stored entry. Round 1 caught that with the `duel` flag — deleting it from the
 * drawn one left every test green while the printed certificate called a duel a "mission" and the album still
 * called it a duel. Round 2 caught the identical shape one field over: with `avatar` passed in separately, the
 * drawn ninja (`av`) and the stored id (`d.avatar`) were two independent reads again, and a certificate could
 * be **signed by the wrong ninja** with the album none the wiser.
 *
 * So the avatar's id comes from the resolved `Avatar` this certificate actually carries, and the award day from
 * its own `date`. Both are narrowings of the same value rather than second readings of the source — which is
 * what makes "the stored assertions cover the drawn object" true rather than merely claimed (#397 round 2, B1).
 * `date` is required on `CertInfo` (#410) precisely so this function's UTC day and `certificateText()`'s
 * printed day are always narrowings of that one caller-supplied instant, rather than two independent
 * `new Date()` defaults free to land a whole calendar day apart.
 */
export function certToStored(c: CertInfo, o: { id: string }): StoredCert {
  return {
    id: o.id, name: c.name, avatar: c.avatar.id, year: c.year, title: c.title,
    stars: c.stars, score: c.score, correct: c.correct, attempts: c.attempts,
    date: isoDay(c.date), training: c.training, duel: c.duel,
  };
}
/** The award day as the album stores it. Mirrors `storage.ts`'s `today()`; kept here so this module's two
 *  directions (`certToStored`/`certFromStored`) agree about the format without importing save machinery. */
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
/**
 * `isoDay(d)`, read for a human at local noon (#410) — the same trick `certFromStored()` uses when it parses
 * a stored day back into a `Date`, applied here going the other way so `certificateText()` never has to format
 * `d` itself. Formatting `d` directly would read *its* local calendar day, which is not necessarily the UTC day
 * `certToStored()` is about to file this same certificate under — the split this issue describes. Routing
 * through the stored day first means the printed keepsake and the album row always name the same day, whatever
 * the child's timezone and whatever the clock read at the exact moment each was computed.
 *
 * Guards an Invalid `Date` before it reaches `isoDay`'s `toISOString()`, which throws rather than degrading
 * (#410 review): `date` is required on every fresh `CertInfo`, but `certFromStored()` parses it back out of
 * `StoredCert.date`, a plain string `isCert()` only checks is a `string`, never that it parses. A hand-edited
 * or corrupted save reaches `showStoredCertificate()` → `drawCertificate()` → `certificateText()` →
 * `displayDay()` with no `catch` above it, so a throw here is an unhandled rejection, not a caught error — the
 * "My certificates" view button silently re-enables and nothing opens. Returning `''` instead matches the
 * degradation `certAlbumHTML` already applies to the same input (`Number.isNaN(d.getTime()) ? '' : ...`).
 */
const displayDay = (d: Date): string =>
  Number.isNaN(d.getTime()) ? '' :
  new Date(`${isoDay(d)}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/** The words on a certificate that has just been earned — what `drawCertificate()` will paint (#397 round 2,
 *  B1). Exposed so the duel e2e can read the signature and the reason off the *drawn* object rather than
 *  inferring them from a byte count, which cannot tell one ninja from another. */
export const certWords = (c: CertInfo): CertText => certificateText(c);
/**
 * "My certificates" (#110): a row per earned certificate, most recently filed first, or an empty-state hint.
 * Pure and unit-tested without a DOM — mirrors `stickersHTML`'s shape in `ui/screen.ts`. Each row carries the
 * cert's `id` in `data-id` so the caller can look it up in `certificates()` and redraw it full-screen; nothing
 * here draws a canvas; that stays lazy (only when a certificate is actually opened) because the album can
 * hold up to `CERT_CAP` (60) entries.
 */
export function certAlbumHTML(certs: StoredCert[]): string {
  if (!certs.length) return '<p class="cert-empty">Win a mission, finish Sensei training or win a Ninja Duel to earn your first certificate — it will show up here.</p>';
  const rows = certs.map(c => {
    const a = avatarById(c.avatar);
    const stars = '★'.repeat(Math.max(0, Math.min(3, c.stars))) + '☆'.repeat(3 - Math.max(0, Math.min(3, c.stars)));
    const d = new Date(`${c.date}T12:00:00`);
    const date = Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return `<div class="cert-row"><span class="cert-ava" style="--glow:${a.glow}"><img src="${a.img}" alt=""></span><div class="cert-info"><b>${esc(c.title)}</b><small>${esc(c.year)}${date ? ` · ${date}` : ''}</small></div><span class="cert-stars" aria-hidden="true">${stars}</span><button class="btn cert-open" data-id="${esc(c.id)}">View</button></div>`;
  }).join('');
  return `<div class="cert-list">${rows}</div>`;
}

export interface CertText { heading: string; awarded: string; child: string; reason: string; detail: string; stars: string; date: string; signed: string }

/** The words on the certificate (pure, unit-tested). */
export function certificateText(i: CertInfo): CertText {
  const date = displayDay(i.date);
  const acc = i.attempts ? Math.round(100 * i.correct / i.attempts) : 0;
  // A duel is not a mission and the certificate may not call it one: the child won a race against a friend on
  // one device, and "completed the Counting mission" would be the wrong claim on a printed, kept record.
  const reason = {
    duel: `won a Ninja Duel on ${i.year} Island`,
    sensei: `completed Sensei training on ${i.year} Island`,
    mission: `completed the ${i.title} mission on ${i.year} Island`,
  }[certKind(i)];
  return {
    heading: 'Sky Ninja Academy', awarded: 'Certificate of Achievement', child: i.name.trim() || 'Ninja',
    reason,
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
export type CertRoute = 'share' | 'save' | 'capacitor' | 'show' | 'download';
export type CertOutcome = 'shared' | 'saved' | 'shown' | 'downloaded' | 'declined';

/**
 * Which delivery route to use, given what the runtime supports (pure, unit-tested).
 * Priority: the system share sheet (phones) → the artifact viewer's save prompt →
 * the Capacitor share sheet (Android APK, when the plugins are actually there) →
 * a full-screen "press & hold to save" view (artifact viewer with no downloads grant, or a native shell
 * whose plugins are missing) → a plain `<a download>` (static / PWA build, no artifact runtime).
 *
 * `nativeShell` is the Android APK's Capacitor WebView (#205). A stock Android WebView has no download
 * handler, so `a.click()` on an `<a download>` is swallowed without a word: the child presses the button
 * and nothing happens at all. `<a download>` is therefore never the last resort on a runtime that cannot
 * honour it — the full-screen view is, because press-and-hold on an image works there.
 *
 * `capacitorShare` (#110) is `nativeShell` plus the `Filesystem`/`Share` plugins actually being present on
 * the bridge — the APK ships them (see `shareViaCapacitor` below), but the check stays capability-based
 * rather than assuming every native build carries them, the same reasoning `isNativeShell` already uses.
 * `claudeRuntime` still wins over it: an artifact-viewer host is never also the Android shell, but if that
 * ever changed, its own save prompt is the better route.
 */
export function certRoute(caps: { canShareFiles: boolean; claudeSave: boolean; claudeRuntime: boolean; nativeShell: boolean; capacitorShare: boolean }): CertRoute {
  if (caps.canShareFiles) return 'share';
  if (caps.claudeSave) return 'save';
  if (caps.claudeRuntime) return 'show';
  if (caps.nativeShell && caps.capacitorShare) return 'capacitor';
  if (caps.nativeShell) return 'show';
  return 'download';
}

/**
 * The Capacitor `Filesystem`/`Share` plugins (#110), read off the same injected bridge `isNativeShell`
 * (`../native`) already reads — no import, so a web build that never runs inside the APK never bundles them.
 * Both plugins register themselves onto the bridge under their class name; this only asks whether they
 * answered.
 */
interface CapFilesystem { writeFile(o: { path: string; data: string; directory: string }): Promise<{ uri: string }> }
interface CapShare { share(o: { url?: string; title?: string; dialogTitle?: string }): Promise<void> }

/** Are both plugins this route needs actually on the bridge? (pure capability check, no I/O) */
export function hasCapacitorShare(w: Window & typeof globalThis = window): boolean {
  return !!plugin<CapFilesystem>('Filesystem', w) && !!plugin<CapShare>('Share', w);
}

/**
 * Write the certificate PNG into the app's cache directory and hand it to the Android share sheet (#110).
 * `directory: 'CACHE'` matches Capacitor's own `Directory.Cache` enum value, kept as a string so this file
 * still imports nothing from `@capacitor/filesystem` — only the plugin's *shape* is typed, above.
 *
 * Returns `false` on any failure (a missing plugin, a full cache, a share-sheet cancel counts as `Share`
 * resolving normally on Android so this only turns false on a real error) — the caller falls back to the
 * full-screen view, never to `<a download>`, for the same reason `certRoute` never chooses it here.
 */
async function shareViaCapacitor(c: HTMLCanvasElement, filename: string): Promise<boolean> {
  const Filesystem = plugin<CapFilesystem>('Filesystem');
  const Share = plugin<CapShare>('Share');
  if (!Filesystem || !Share) return false;
  try {
    const dataUrl = c.toDataURL('image/png');
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    const { uri } = await Filesystem.writeFile({ path: filename, data: base64, directory: 'CACHE' });
    await Share.share({ url: uri, title: 'Sky Ninja Academy certificate', dialogTitle: 'Share your certificate' });
    return true;
  } catch { return false; }
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

/**
 * Full-screen view of the certificate with a press-and-hold hint — the fallback where no save API works, and
 * (#110) the "View" route from the "My certificates" album. Tap the picture to zoom in for a closer look at
 * the detail; tap again to zoom back out. A zoomed tap must not also close the view through the backdrop
 * handler below, so it stops the click reaching `wrap`.
 */
export function showCertificateFullscreen(c: HTMLCanvasElement): void {
  document.querySelector('.cert-view')?.remove();
  const wrap = document.createElement('div'); wrap.className = 'cert-view'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-label', 'Your certificate');
  const img = new Image(); img.className = 'cert-view-img'; img.alt = 'Your Sky Ninja Academy certificate — tap to zoom'; img.src = c.toDataURL('image/png');
  img.addEventListener('click', e => { e.stopPropagation(); img.classList.toggle('zoomed'); wrap.classList.toggle('zoomed', img.classList.contains('zoomed')); });
  const hint = document.createElement('p'); hint.className = 'cert-view-hint'; hint.textContent = 'Tap to zoom · Press and hold to save 📥';
  const done = document.createElement('button'); done.className = 'btn big'; done.textContent = 'Done';
  const close = () => wrap.remove();
  done.addEventListener('click', close);
  wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
  wrap.append(img, hint, done);
  document.body.appendChild(wrap);
}

/** Redraw and open a previously earned certificate from the album (#110). */
export async function showStoredCertificate(c: StoredCert): Promise<void> {
  showCertificateFullscreen(await drawCertificate(certFromStored(c)));
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
  const capacitorShare = nativeShell && hasCapacitorShare();

  // The one place `<a download>` is chosen, so the runtime that cannot honour it is ruled out in one
  // place too. A cancelled share used to step down past this check straight to `triggerDownload`.
  const lastResort = (): CertOutcome => {
    if (nativeShell) { showCertificateFullscreen(c); return 'shown'; }
    triggerDownload(blob, filename); return 'downloaded';
  };

  switch (certRoute({ canShareFiles, claudeSave: !!dl, claudeRuntime, nativeShell, capacitorShare })) {
    case 'share':
      try { await nav.share!({ files: [file], title: 'Sky Ninja Academy certificate' }); return 'shared'; }
      catch { /* cancelled → step down to the next best route */ }
      if (dl) return saveViaClaude(dl, filename, blob, c);
      if (claudeRuntime) { showCertificateFullscreen(c); return 'shown'; }
      return lastResort();
    case 'save':
      return saveViaClaude(dl!, filename, blob, c);
    case 'capacitor':
      if (await shareViaCapacitor(c, filename)) return 'shared';
      showCertificateFullscreen(c); return 'shown';   // the plugin call itself failed — never fall to <a download>
    case 'show':
      showCertificateFullscreen(c); return 'shown';
    default:
      return lastResort();
  }
}

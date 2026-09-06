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
 */
export function certRoute(caps: { canShareFiles: boolean; claudeSave: boolean; claudeRuntime: boolean }): CertRoute {
  if (caps.canShareFiles) return 'share';
  if (caps.claudeSave) return 'save';
  if (caps.claudeRuntime) return 'show';
  return 'download';
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
 * Web Share (files) → artifact `downloads` save prompt → full-screen press-and-hold view → `<a download>`.
 */
export async function deliverCertificate(c: HTMLCanvasElement, filename: string): Promise<CertOutcome> {
  const blob = await new Promise<Blob | null>(res => c.toBlob(res, 'image/png'));
  if (!blob) throw new Error('certificate: could not encode PNG');
  const file = new File([blob], filename, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const canShareFiles = !!nav.canShare?.({ files: [file] });
  const claudeRuntime = !!(window as { claude?: unknown }).claude;
  const dl = claudeRuntime ? await claudeDownloads() : null;

  switch (certRoute({ canShareFiles, claudeSave: !!dl, claudeRuntime })) {
    case 'share':
      try { await nav.share!({ files: [file], title: 'Sky Ninja Academy certificate' }); return 'shared'; }
      catch { /* cancelled → step down to the next best route */ }
      if (dl) return saveViaClaude(dl, filename, blob, c);
      if (claudeRuntime) { showCertificateFullscreen(c); return 'shown'; }
      triggerDownload(blob, filename); return 'downloaded';
    case 'save':
      return saveViaClaude(dl!, filename, blob, c);
    case 'show':
      showCertificateFullscreen(c); return 'shown';
    default:
      triggerDownload(blob, filename); return 'downloaded';
  }
}

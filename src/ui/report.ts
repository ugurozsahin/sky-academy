// The grown-ups "Progress picture" (#943): a one-page PNG of the same summary the text note carries, drawn like the
// certificate and delivered by its routes. A placeholder layout (final look: #1026) — all drawing stays in drawProgressReport().
import type { Avatar } from '../avatars';
import { pct, type ParentSummary } from '../game/parents';
import { fitSize, loadImage, roundRect, wrap } from './certificate';

export interface ReportInfo { sm: ParentSummary; name: string; avatar: Avatar; date: Date }
export interface ReportText { heading: string; title: string; child: string; date: string; week: string; islands: { label: string; stars: number; max: number }[]; going: string; help: string }

const list = (ts: readonly { title: string }[]) => ts.slice(0, 4).map(t => t.title).join(', ') || 'not enough play yet';

/** The words on the picture (pure, unit-tested): the same facts as `progressText()`, laid out for a page. */
export function reportText(i: ReportInfo): ReportText {
  const w = i.sm.week;
  return {
    heading: 'Sharpwise', title: 'Progress report', child: i.name.trim() || 'Your ninja',
    date: Number.isNaN(i.date.getTime()) ? '' : i.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    week: w.days ? `This week: ${w.days}/7 days played, ${w.questions} questions${w.accuracy === null ? '' : `, ${pct(w.accuracy)}% right`}` : 'This week: no play yet',
    islands: i.sm.years.map(y => ({ label: y.title, stars: y.stars, max: y.maxStars })),
    going: list(i.sm.strongest), help: list(i.sm.weakest),
  };
}

/** Portrait 850×1200 on the certificate's palette, border and fonts; the avatar is an existing image. */
export async function drawProgressReport(i: ReportInfo): Promise<HTMLCanvasElement> {
  const t = reportText(i), W = 850, H = 1200;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  try { await (document as any).fonts?.ready; } catch { /* fall back to system fonts */ }
  const font = (px: number, w = 700) => `${w} ${px}px Fredoka, "Baloo 2", Nunito, system-ui, sans-serif`;
  const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#5aa9ff'); sky.addColorStop(1, '#dff3ff'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
  g.fillStyle = '#fffdf5'; g.strokeStyle = i.avatar.glow; g.lineWidth = 10; roundRect(g, 40, 40, W - 80, H - 80, 36); g.fill(); g.stroke();
  g.strokeStyle = '#ffb020'; g.lineWidth = 3; roundRect(g, 60, 60, W - 120, H - 120, 26); g.stroke();
  const img = await loadImage(i.avatar.img);
  if (img) { g.save(); g.shadowColor = i.avatar.glow; g.shadowBlur = 30; const h = 200, w = h * img.width / img.height; g.drawImage(img, W - 100 - w, 90, w, h); g.restore(); }
  g.textAlign = 'left'; g.textBaseline = 'alphabetic'; const x = 100;
  g.fillStyle = '#1a1f44'; g.font = font(28, 600); g.fillText(t.heading.toUpperCase(), x, 140);
  g.fillStyle = '#ff7a1a'; g.font = font(52); g.fillText(t.title, x, 205);
  g.fillStyle = '#1a1f44'; g.font = font(fitSize(g, t.child, 64, 440, 700)); g.fillText(t.child, x, 285);
  g.fillStyle = '#4c5680'; g.font = font(24, 500); g.fillText(t.date, x, 330);
  g.fillStyle = '#1a1f44'; g.font = font(26, 600); g.fillText(t.week, x, 400);
  // stars per island as bars
  let y = 450; g.font = font(24, 600);
  for (const r of t.islands) {
    g.fillStyle = '#1a1f44'; g.textAlign = 'left'; g.fillText(r.label, x, y + 22);
    g.fillStyle = '#e6ecf7'; roundRect(g, 300, y, 330, 28, 14); g.fill();
    if (r.max > 0 && r.stars > 0) { g.fillStyle = '#ffb020'; roundRect(g, 300, y, Math.max(28, 330 * Math.min(1, r.stars / r.max)), 28, 14); g.fill(); }
    g.fillStyle = '#4c5680'; g.textAlign = 'right'; g.fillText(`${r.stars}/${r.max}`, W - 100, y + 22); y += 46;
  }
  g.textAlign = 'left'; y += 30;
  g.fillStyle = '#2e9d57'; g.font = font(30); g.fillText('Going well', x, y);
  g.fillStyle = '#4c5680'; g.font = font(26, 500); wrap(g, t.going, x, y + 42, W - 200, 36); y += 150;
  g.fillStyle = '#e0561b'; g.font = font(30); g.fillText('Where to help', x, y);
  g.fillStyle = '#4c5680'; g.font = font(26, 500); wrap(g, t.help, x, y + 42, W - 200, 36);
  return c;
}

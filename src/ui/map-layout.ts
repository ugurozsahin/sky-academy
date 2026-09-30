import type { YearInfo } from '../curriculum/types';
import { islandArt } from './island-placeholder';

/**
 * #1048: the Sky Map's layout, the only place it is decided. With 4–7 islands, today's single-column phone
 * row (952 px for seven) and one-column-per-year desktop grid (95 px columns at seven) both break — this
 * caps desktop at 4 columns with balanced rows and shrinks the phone row once there are 4 or more islands.
 */

/** Never more than 4 columns; rows stay as even as `Math.ceil` allows (5 → 3+2, 6 → 3+3, 7 → 4+3). */
export function mapCols(n: number): number {
  return n <= 4 ? n : Math.ceil(n / Math.ceil(n / 4));
}

export type MapLayout = { cols: number; compact: boolean };

/**
 * `compact` is true from n = 4: the row switches to a smaller size — the same 96×64 art size `isl-head`
 * already uses — carried as inline custom properties on the `.islands` container so it applies at every
 * width; the ≥720px media rules in `home.css` still decide row-vs-column layout and padding on top of it.
 * The actual `--isl-h`/`--isl-pad`/`--art-w`/`--art-h` declarations live at the one place they are read — the
 * `style="…"` attribute `mapScreen` (`home.ts`) writes — rather than in a string this function hands back:
 * the #399 rail only credits a custom property as declared where a browser can actually read it, a literal
 * `style="…"` attribute, and a string returned from here is neither literal nor an attribute until `home.ts`
 * writes it into one.
 */
export function mapLayout(n: number): MapLayout {
  return { cols: mapCols(n), compact: n >= 4 };
}

/**
 * The island buttons themselves. `stars` is passed in rather than read here so this module stays pure (no
 * `storage`/`load()` dependency) — `mapScreen` already has `progress` loaded for the rest of the screen.
 * Compact mode drops only the blurb from the subtitle; everything else — `data-year`, the `aria-label`, the
 * `.sel` class, the art, the star bar — is unchanged, so the #27 rail (distinct art, one button per year)
 * keeps holding.
 */
export function islandsHTML(
  years: readonly YearInfo[],
  stars: (y: YearInfo) => { s: number; m: number },
  selId: string | undefined,
  compact: boolean,
): string {
  return years.map((y, i) => {
    const { s, m } = stars(y);
    return `
        <button class="island${y.id === selId ? ' sel' : ''}" data-year="${y.id}" style="--tint:${y.tint}" aria-label="${y.title} island">
          <span class="isl-art" style="background-image:url(&quot;${islandArt(y)}&quot;);animation-delay:${(-1.3 * i).toFixed(1)}s"></span>
          <span class="isl-text"><b>${y.title}</b><small>${compact ? y.age : `${y.age} · ${y.blurb}`}</small>
          <span class="isl-bar"><i style="width:${m ? Math.round(100 * s / m) : 0}%"></i></span><span class="isl-stars">★ ${s}/${m}</span></span>
          <span class="isl-go">Go →</span>
        </button>`;
  }).join('');
}

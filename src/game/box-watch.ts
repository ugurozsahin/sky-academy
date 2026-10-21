// Re-measure when an element's OWN box changes (#678). A window `resize` misses the duel's question bar changing
// height between rounds (#592 shares that box), so a ResizeObserver covers it, where the browser has one.
// Loop guard: the callback may itself change the box (assigning `canvas.width` can), so the observer path only
// calls through when the size differs from the last one measured by a whole CSS pixel, and batches to one animation
// frame. The whole pixel matters: the two halves of a duel settle a sub-pixel apart (194.390625 vs 194.375), and
// `Arena.resize` derives each bubble's `g` from H, so re-measuring on that would hand the halves different waves
// (#389/#400). Both halves measured equal at construction; only a real change may re-measure them now.
export const BOX_EPSILON = 1;
export function watchBox(el: HTMLElement, onChange: () => void): () => void {
  let w = 0, h = 0, raf = 0;
  const measure = () => { const r = el.getBoundingClientRect(); w = r.width; h = r.height; };
  const fire = () => { onChange(); measure(); };
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const r = el.getBoundingClientRect();
      if (Math.abs(r.width - w) >= BOX_EPSILON || Math.abs(r.height - h) >= BOX_EPSILON) fire();
    });
  }) : null;
  measure();
  // #2184: and the visual viewport, which a phone's toolbar can resize with no window `resize` on some browsers.
  const vv = (window as { visualViewport?: EventTarget | null }).visualViewport ?? null;
  window.addEventListener('resize', fire);
  vv?.addEventListener('resize', fire);
  ro?.observe(el);
  return () => { window.removeEventListener('resize', fire); vv?.removeEventListener('resize', fire); ro?.disconnect(); if (raf) cancelAnimationFrame(raf); raf = 0; };
}

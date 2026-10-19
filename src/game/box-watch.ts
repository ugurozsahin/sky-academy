// Re-measure when an element's OWN box changes (#678). A window `resize` misses the duel's question bar changing
// height between rounds (#592 shares that box), so a ResizeObserver covers it, where the browser has one.
// Loop guard: the callback may itself change the box (assigning `canvas.width` can), so the observer path only
// calls through when the size differs from the last one measured, and batches to one animation frame.
export function watchBox(el: HTMLElement, onChange: () => void): () => void {
  let w = 0, h = 0, raf = 0;
  const measure = () => { const r = el.getBoundingClientRect(); w = r.width; h = r.height; };
  const fire = () => { onChange(); measure(); };
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const r = el.getBoundingClientRect();
      if (r.width !== w || r.height !== h) fire();
    });
  }) : null;
  measure();
  window.addEventListener('resize', fire);
  ro?.observe(el);
  return () => { window.removeEventListener('resize', fire); ro?.disconnect(); if (raf) cancelAnimationFrame(raf); raf = 0; };
}

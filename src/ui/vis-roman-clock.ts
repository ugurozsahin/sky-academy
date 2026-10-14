// Roman-numeral clock face (#1078): same face, hands and classes as `clockSVG`, numbered I–XII.
// Numerals are 11 units in a 100-unit viewBox, so 13.2 px on the 120 px `.clock` — over the 13 px floor.
import { toRoman } from '../curriculum/roman';

export function romanClockSVG(h: number, m: number): string {
  const ha = ((h % 12) + m / 60) * 30, ma = m * 6, rad = Math.PI / 180;
  const nums = Array.from({ length: 12 }, (_, i) => {
    const a = (i + 1) * 30 * rad;
    return `<text x="${(50 + 34 * Math.sin(a)).toFixed(1)}" y="${(50 - 34 * Math.cos(a) + 4).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700">${toRoman(i + 1)}</text>`;
  }).join('');
  return `<svg viewBox="0 0 100 100" class="clock"><circle cx="50" cy="50" r="47" class="face"/>${nums}
  <line x1="50" y1="50" x2="${(50 + 22 * Math.sin(ha * rad)).toFixed(1)}" y2="${(50 - 22 * Math.cos(ha * rad)).toFixed(1)}" class="hour"/>
  <line x1="50" y1="50" x2="${(50 + 32 * Math.sin(ma * rad)).toFixed(1)}" y2="${(50 - 32 * Math.cos(ma * rad)).toFixed(1)}" class="min"/><circle cx="50" cy="50" r="3" class="pin"/></svg>`;
}

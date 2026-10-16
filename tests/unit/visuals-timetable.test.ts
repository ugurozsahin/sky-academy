import { describe, it, expect } from 'vitest';
import { renderVisual } from '../../src/ui/visuals';

describe('chart visual: timetable variant of the table (#1216)', () => {
  const rows = [{ label: 'Station', n: 585 }, { label: 'Park', n: 605 }, { label: 'School', n: 630 }];
  it('draws minutes after midnight as 24-hour HH:MM, and the hidden row as ?', () => {
    const h = renderVisual({ type: 'chart', kind: 'table', rows, head: ['Stop', 'Time'], time: true, hide: 2 });
    const segs = h.split('class="chart-row"').slice(1);
    expect(segs).toHaveLength(4);
    expect(segs[1]).toContain('>09:45</span>'); expect(segs[2]).toContain('>10:05</span>'); expect(segs[3]).toContain('>?</span>');
  });
  it('draws a time past the tally cap of 200 (a day is 1439 minutes) and still caps a malformed one', () => {
    expect(renderVisual({ type: 'chart', kind: 'table', rows: [{ label: 'a', n: 1260 }], head: ['Stop', 'Time'], time: true })).toContain('>21:00</span>');
    expect(renderVisual({ type: 'chart', kind: 'table', rows: [{ label: 'a', n: 1440 }], head: ['Stop', 'Time'], time: true })).toContain('>00:00</span>');
  });
  it('leaves a table without time or hide byte-identical', () => {
    const plain = [{ label: '🐶 dogs', n: 7 }, { label: '🐱 cats', n: 120 }];
    expect(renderVisual({ type: 'chart', kind: 'table', rows: plain, head: ['Pet', 'Children'] })).toBe(
      '<div class="vis"><div class="chart table"><div class="chart-row"><span class="cat">Pet</span><span class="data">Children</span></div><div class="chart-row"><span class="cat">🐶 dogs</span><span class="data">7</span></div><div class="chart-row"><span class="cat">🐱 cats</span><span class="data">120</span></div></div></div>');
  });
});

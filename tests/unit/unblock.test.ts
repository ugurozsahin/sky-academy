import { describe, expect, it } from 'vitest';
import { blockersOf, staleBlocked } from '../../scripts/unblock.mjs';

/**
 * #1360: `.github/workflows/unblock.yml` removes `blocked` from whatever `staleBlocked()` returns. A wrong
 * removal puts parked work in front of an hourly developer run, so every case that must KEEP the label is
 * written out, not only the ones that remove it.
 */
const issue = (number: number, body: string, labels: string[] = ['blocked'], pr = false) =>
  ({ number, body, labels: labels.map((name) => ({ name })), ...(pr ? { pull_request: {} } : {}) });

describe('blockersOf reads the first line only, and fails towards keeping the label (#1360)', () => {
  it.each([
    ['Blocked by #883', [883]],
    ['Blocked by #889, #1000, #888, #1059\n\nMore text.', [889, 1000, 888, 1059]],
    ['  \nBlocked by #12 and #13 (both land first)', [12, 13]],
    ['blocked by #7', [7]],
  ])('%j names %j', (body, want) => expect(blockersOf(body)).toEqual(want));

  it.each([
    ['no Blocked by line at all', 'Some issue.\nBlocked by #5'],
    ['a line with no number', 'Blocked by the owner decision'],
    ['a reference into another repository', 'Blocked by other/repo#5'],
    ['an empty body', ''],
  ])('%s is null', (_, body) => expect(blockersOf(body)).toBeNull());

  it('handles a null body', () => expect(blockersOf(null)).toBeNull());
});

describe('staleBlocked returns only the issues whose every blocker is closed (#1360)', () => {
  it('removes the label once the one blocker has closed', () => {
    expect(staleBlocked([issue(884, 'Blocked by #883')])).toEqual([884]);
  });

  it('keeps the label while any named blocker is still open', () => {
    const open = [issue(20, 'Blocked by #10, #11'), issue(11, 'Open blocker.', [])];
    expect(staleBlocked(open)).toEqual([]);
  });

  it('counts an open pull request as an open blocker', () => {
    expect(staleBlocked([issue(20, 'Blocked by #30'), issue(30, 'A PR', [], true)])).toEqual([]);
  });

  it('treats the issue that woke the run as closed, even if the listing still shows it open', () => {
    const open = [issue(20, 'Blocked by #10'), issue(10, 'Just closed.', [])];
    expect(staleBlocked(open)).toEqual([]);
    expect(staleBlocked(open, 10)).toEqual([20]);
  });

  it('never touches an issue without the label, one without a Blocked by line, or a pull request', () => {
    const open = [issue(1, 'Blocked by #99', []), issue(2, 'No line.'), issue(3, 'Blocked by #99', ['blocked'], true)];
    expect(staleBlocked(open)).toEqual([]);
  });

  it('accepts labels as plain strings too', () => {
    expect(staleBlocked([{ number: 5, body: 'Blocked by #4', labels: ['blocked'] }])).toEqual([5]);
  });
});

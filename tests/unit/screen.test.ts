import { describe, expect, it } from 'vitest';
import { resultsModal, stickersHTML, type ResultsModalParts } from '../../src/ui/screen';

// A minimal, memory-style parts object (no boss K.O., no certificate, no extra hero classes).
const base: ResultsModalParts = {
  glow: '#40c4ff', img: '/avatars/kai.webp', name: 'Kai', headline: 'Great job!',
  medal: '🥇', heading: 'All pairs found!',
  stars: 3,
  stats: '<div><b>120</b><small>score</small></div>',
  coins: 8,
  dojoRows: '', stickerHTML: '',
};

describe('resultsModal (#35 — the shared end-of-run modal shell)', () => {
  it('always renders the modal shell and the Play again / Islands buttons', () => {
    const h = resultsModal(base);
    expect(h).toContain('<div class="modal results">');
    expect(h).toContain('<button class="btn primary big" id="again">Play again</button>');
    expect(h).toContain('<button class="btn big" id="home">Islands</button>');
  });

  it('the medal, heading, stat grid and coin gain come straight from the slots', () => {
    const h = resultsModal(base);
    expect(h).toContain('<div class="medal">🥇</div>');
    expect(h).toContain('<h2>All pairs found!</h2>');
    expect(h).toContain('<div class="statgrid"><div><b>120</b><small>score</small></div></div>');
    expect(h).toContain('<span class="coin-gain">+8 🪙</span>');
  });

  it('escapes the headline in the speech bubble', () => {
    const h = resultsModal({ ...base, headline: '5 < 8 rocks' });
    expect(h).toContain('5 &lt; 8 rocks');
    expect(h).not.toContain('5 < 8 rocks');
  });

  it('a bare hero has no trailing class, an extra class is appended verbatim', () => {
    expect(resultsModal(base)).toContain('<div class="hero-big" style="--glow:#40c4ff">');
    expect(resultsModal({ ...base, heroExtra: ' sad' })).toContain('<div class="hero-big sad" style');
    expect(resultsModal({ ...base, heroExtra: ' sensei' })).toContain('<div class="hero-big sensei" style');
  });

  it('shows the star row when a star count is given and hides it when omitted', () => {
    expect(resultsModal({ ...base, stars: 2 })).toContain('<div class="big-stars">');
    expect(resultsModal({ ...base, stars: undefined })).not.toContain('big-stars');
  });

  it('the K.O. banner and the certificate button appear only when their slots are set', () => {
    const plain = resultsModal(base);
    expect(plain).not.toContain('class="ko"');
    expect(plain).not.toContain('id="cert"');
    const boss = resultsModal({ ...base, ko: '<div class="ko" aria-hidden="true"><b>K.O.</b></div>', cert: true });
    expect(boss).toContain('<div class="ko" aria-hidden="true"><b>K.O.</b></div>');
    expect(boss).toContain('id="cert"');
  });

  it('appends pills after the coin gain (new best, day streak)', () => {
    const h = resultsModal({ ...base, pills: '<span class="best-pill">🏆 New best!</span>' });
    expect(h).toContain('<span class="coin-gain">+8 🪙</span><span class="best-pill">🏆 New best!</span>');
  });
});

describe('stickersHTML (#35)', () => {
  it('renders nothing for an empty unlock list', () => {
    expect(stickersHTML([])).toBe('');
  });
  it('renders one unlock card per freshly earned avatar', () => {
    const h = stickersHTML(['kai']);
    expect(h).toContain('New sticker!');
    expect((h.match(/class="unlock"/g) ?? []).length).toBe(1);
  });
});

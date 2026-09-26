import { describe, expect, it } from 'vitest';
import { capDigits, fillAnswer } from '../../src/ui/dom';

const plain = (s: string) => s.replace(/<[^>]+>/g, '');
describe('fillAnswer (outcome card)', () => {
  it('fills the gap in equation, sequence, compare and blank prompts', () => {
    expect(plain(fillAnswer('3 + 4 = ?', '7'))).toBe('3 + 4 = 7');
    expect(plain(fillAnswer('? − 1 = 17', '18'))).toBe('18 − 1 = 17');
    expect(plain(fillAnswer('13 + 1 = ? − 4', '18'))).toBe('13 + 1 = 18 − 4');
    expect(plain(fillAnswer('5, 6, 7, ?', '8'))).toBe('5, 6, 7, 8');
    expect(plain(fillAnswer('9 ? 13', '<'))).toBe('9 &lt; 13');
    expect(plain(fillAnswer('Mo_day', 'n'))).toBe('Monday');
    expect(plain(fillAnswer('I can ___ you.', 'hear'))).toBe('I can hear you.');
    expect(plain(fillAnswer('Do you like pizza_', '?'))).toBe('Do you like pizza?');
    expect(fillAnswer('4 + ? = 5', '1')).toContain('<span class="ans">1</span>');
  });
  it('leaves question sentences alone and escapes html', () => {
    for (const p of ['How many?', 'One more than 3?', 'Change from £1 for 5p?', 'Which is a cone?']) expect(fillAnswer(p, '4')).toBe(p);
    expect(fillAnswer('9 ? 13', '<')).toContain('&lt;');
  });
});

describe('capDigits (the topbar coin pill has a bounded width regardless of balance, #510)', () => {
  it('shows the real number up to four figures, and caps at "9999+" past it', () => {
    expect(capDigits(0)).toBe('0');
    expect(capDigits(40)).toBe('40');
    expect(capDigits(1250)).toBe('1250');
    expect(capDigits(9999)).toBe('9999');
    expect(capDigits(10000)).toBe('9999+');
    expect(capDigits(12345)).toBe('9999+');
  });
});

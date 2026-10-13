import { describe, it, expect, afterEach, vi } from 'vitest';
import { mapLineDay, setMapLineDay } from '../../src/device-settings';

describe('mapLineDay: once-a-day key (#955)', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('is per profile and round-trips', () => {
    const mem = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); } });
    expect(mapLineDay('a')).toBeNull();
    expect(setMapLineDay('a', '2026-10-13')).toBe(true);
    expect(mapLineDay('a')).toBe('2026-10-13');
    expect(mapLineDay('b')).toBeNull();
  });
  it('a store that throws never throws', () => {
    const boom = () => { throw new Error('no'); };
    vi.stubGlobal('localStorage', { getItem: boom, setItem: boom });
    expect(mapLineDay('a')).toBeNull();
    expect(setMapLineDay('a', '2026-10-13')).toBe(false);
  });
});

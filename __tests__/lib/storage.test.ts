import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readJSON, remove, writeJSON } from '@/lib/storage';

describe('lib/storage', () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    const localStorageMock = {
      getItem: vi.fn((key: string) => (key in store ? store[key] : null)),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        store = {};
      }),
      key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
      get length() {
        return Object.keys(store).length;
      },
    };
    vi.stubGlobal('localStorage', localStorageMock);
    vi.stubGlobal('window', { localStorage: localStorageMock });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('readJSON', () => {
    it('returns the fallback when the key is missing', () => {
      expect(readJSON('missing', { a: 1 })).toEqual({ a: 1 });
    });

    it('returns the fallback when the stored value is malformed JSON', () => {
      store['bad'] = '{not valid json';
      expect(readJSON('bad', 'fallback')).toBe('fallback');
    });

    it('parses and returns a stored value', () => {
      store['good'] = JSON.stringify({ a: 1, b: [2, 3] });
      expect(readJSON('good', null)).toEqual({ a: 1, b: [2, 3] });
    });

    it('returns the fallback on SSR (no window)', () => {
      vi.unstubAllGlobals();
      vi.stubGlobal('window', undefined);
      expect(readJSON('anything', 'fallback')).toBe('fallback');
    });

    it('returns the fallback when getItem throws', () => {
      const localStorageMock = {
        getItem: vi.fn(() => {
          throw new Error('SecurityError');
        }),
      };
      vi.stubGlobal('localStorage', localStorageMock);
      vi.stubGlobal('window', { localStorage: localStorageMock });
      expect(readJSON('key', 'fallback')).toBe('fallback');
    });
  });

  describe('writeJSON', () => {
    it('round-trips values through readJSON', () => {
      const value = { a: 1, b: ['x', 'y'], c: true };
      writeJSON('roundtrip', value);
      expect(readJSON('roundtrip', null)).toEqual(value);
    });

    it('round-trips primitive values', () => {
      writeJSON('num', 42);
      expect(readJSON('num', null)).toBe(42);
      writeJSON('str', 'hello');
      expect(readJSON('str', null)).toBe('hello');
      writeJSON('bool', false);
      expect(readJSON('bool', null)).toBe(false);
    });

    it('no-ops on SSR (no window)', () => {
      vi.unstubAllGlobals();
      vi.stubGlobal('window', undefined);
      expect(() => writeJSON('key', { a: 1 })).not.toThrow();
    });

    it('swallows setItem quota errors', () => {
      const localStorageMock = {
        setItem: vi.fn(() => {
          throw new Error('QuotaExceededError');
        }),
      };
      vi.stubGlobal('localStorage', localStorageMock);
      vi.stubGlobal('window', { localStorage: localStorageMock });
      expect(() => writeJSON('key', { a: 1 })).not.toThrow();
    });
  });

  describe('remove', () => {
    it('deletes the key', () => {
      store['toRemove'] = JSON.stringify({ a: 1 });
      remove('toRemove');
      expect(store['toRemove']).toBeUndefined();
      expect(readJSON('toRemove', 'fallback')).toBe('fallback');
    });

    it('no-ops on SSR (no window)', () => {
      vi.unstubAllGlobals();
      vi.stubGlobal('window', undefined);
      expect(() => remove('key')).not.toThrow();
    });

    it('swallows removeItem errors', () => {
      const localStorageMock = {
        removeItem: vi.fn(() => {
          throw new Error('SecurityError');
        }),
      };
      vi.stubGlobal('localStorage', localStorageMock);
      vi.stubGlobal('window', { localStorage: localStorageMock });
      expect(() => remove('key')).not.toThrow();
    });
  });
});
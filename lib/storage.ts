/**
 * Safe localStorage helpers.
 *
 * All access is SSR-safe (no-op / fallback when `window` is undefined) and
 * exception-safe (private mode, quota errors, malformed JSON, etc.).
 */

/**
 * Read and parse a JSON value from localStorage.
 *
 * Returns `fallback` when:
 * - running on the server (`window` is undefined)
 * - the key is missing
 * - the stored value is not valid JSON
 * - accessing localStorage throws
 */
export function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Serialize `value` to JSON and write it to localStorage.
 *
 * No-op on the server. Swallows errors (quota exceeded, private mode, etc.).
 */
export function writeJSON(key: string, value: unknown): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota / private-mode / serialization errors.
  }
}

/**
 * Remove a key from localStorage.
 *
 * No-op on the server. Swallows errors.
 */
export function remove(key: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore errors.
  }
}
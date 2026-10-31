// Values the pages keep in the browser's localStorage, as JSON. Storage may be missing, may
// refuse a read or a write, or may hold anything, so a read falls back and a write says whether
// it was kept.

export interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The page's localStorage, or undefined where the browser refuses access to it. */
export function browserStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** The value stored under `key`, or `fallback()` when storage is missing, unreadable or holds a
 *  value that `isValid` refuses. */
export function load<T>(
  storage: Storage | undefined,
  key: string,
  isValid: (value: unknown) => value is T,
  fallback: () => T,
): T {
  try {
    const stored: unknown = JSON.parse(storage?.getItem(key) ?? "null");
    return isValid(stored) ? stored : fallback();
  } catch {
    return fallback();
  }
}

/** Stores `value` under `key`; returns false when storage is missing or refuses. */
export function save(storage: Storage | undefined, key: string, value: unknown): boolean {
  try {
    storage?.setItem(key, JSON.stringify(value));
    return storage !== undefined;
  } catch {
    return false;
  }
}

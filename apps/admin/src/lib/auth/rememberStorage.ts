/** The part of `Storage` that the auth client needs. `window.localStorage` fits as is. */
export type KeyValueStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function safeGet(store: KeyValueStore, key: string): string | null {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(store: KeyValueStore, key: string, value: string): void {
  try {
    store.setItem(key, value);
  } catch {
    // Storage may be blocked (private mode); the session then lives in memory only.
  }
}

function safeRemove(store: KeyValueStore, key: string): void {
  try {
    store.removeItem(key);
  } catch {
    // Nothing to clear when the store is not available.
  }
}

/**
 * Session storage that follows the "remember on this computer" choice:
 * `local` keeps the session after the browser closes, `session` ends it with the tab.
 * Without an explicit choice (page reload, token refresh) a write goes to the store
 * that already holds the key, or to `local` when neither does.
 */
export function createRememberStorage(local: KeyValueStore, session: KeyValueStore) {
  let remember: boolean | null = null;

  const storage: KeyValueStore = {
    getItem(key) {
      return safeGet(local, key) ?? safeGet(session, key);
    },
    setItem(key, value) {
      const useLocal =
        remember ?? (safeGet(session, key) !== null && safeGet(local, key) === null ? false : true);
      if (useLocal) {
        safeSet(local, key, value);
        safeRemove(session, key);
      } else {
        safeSet(session, key, value);
        safeRemove(local, key);
      }
    },
    removeItem(key) {
      safeRemove(local, key);
      safeRemove(session, key);
    },
  };

  return {
    storage,
    setRemember(value: boolean) {
      remember = value;
    },
  };
}

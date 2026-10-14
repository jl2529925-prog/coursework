const PREFIX = "ledgerleaf:";

export class BrowserStore {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
  }

  read(key, fallback = null) {
    try {
      const raw = this.storage?.getItem(`${PREFIX}${key}`);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  write(key, value) {
    try {
      this.storage?.setItem(`${PREFIX}${key}`, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  remove(key) {
    try {
      this.storage?.removeItem(`${PREFIX}${key}`);
      return true;
    } catch {
      return false;
    }
  }
}

export const defaultPreferences = Object.freeze({
  apiBase: "http://127.0.0.1:5000/api/v1",
  currency: "CNY",
  theme: "auto",
});

export function mergePreferences(candidate = {}) {
  const result = { ...defaultPreferences, ...(candidate && typeof candidate === "object" ? candidate : {}) };
  if (!/^https?:\/\//.test(result.apiBase)) result.apiBase = defaultPreferences.apiBase;
  if (!["CNY", "USD", "EUR", "GBP"].includes(result.currency)) result.currency = defaultPreferences.currency;
  if (!["auto", "light", "dark"].includes(result.theme)) result.theme = defaultPreferences.theme;
  return result;
}


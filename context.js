export default class Context {
  constructor() {
    this.map = new Map();
    this.changed = new Set();
  }

  getRaw(key) {
    return this.map.get(key);
  }

  setRaw(key, entry) {
    this.map.set(key, entry);
  }

  get(key, defValue) {
    const entry = this.getRaw(key);
    if (!entry) {
      if (typeof defValue === 'function') {
        return defValue();
      }
      return defValue;
    }

    if (entry.ttl !== 0) {
      const now = Date.now();
      if (entry.expiresAt < now) {
        this.map.delete(key);
        return undefined;
      }
      entry.expiresAt = now + entry.ttl;
    }

    return entry.value;
  }

  set(key, value, ttl = 0) {
    this.changed.add(key);
    this.setRaw(key, {
      ttl,
      value,
      expiresAt: ttl === 0 ? 0 : Date.now() + ttl * 1000,
    });
  }
}

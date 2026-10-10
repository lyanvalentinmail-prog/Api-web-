'use strict';

/**
 * Caché en memoria con TTL. Se usa para dos cosas:
 *  1. Reducir el número de peticiones que hacemos a las APIs externas (respetar sus límites).
 *  2. Guardar los resultados del chequeo de estado durante unos segundos.
 *
 * Es intencionalmente simple: sin dependencias y con limpieza periódica para no
 * crecer indefinidamente. En despliegues multi-instancia cada proceso tiene su
 * propia caché (ver README).
 */
class TtlCache {
  /** @param {object} [options] @param {number} [options.maxEntries] */
  constructor({ maxEntries = 500 } = {}) {
    this.maxEntries = maxEntries;
    /** @type {Map<string, {value: unknown, expiresAt: number, storedAt: number}>} */
    this.store = new Map();
  }

  /**
   * @param {string} key
   * @returns {{value: unknown, ageMs: number} | null} valor y antigüedad en ms, o null si no hay entrada válida
   */
  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    // Refresca el orden de inserción para un desalojo tipo LRU aproximado.
    this.store.delete(key);
    this.store.set(key, entry);
    return { value: entry.value, ageMs: Date.now() - entry.storedAt };
  }

  /**
   * @param {string} key
   * @param {unknown} value
   * @param {number} ttlMs
   */
  set(key, value, ttlMs) {
    if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) this.store.delete(oldestKey);
    }
    const now = Date.now();
    this.store.set(key, { value, expiresAt: now + ttlMs, storedAt: now });
  }

  /** Elimina entradas caducadas. */
  prune() {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) this.store.delete(key);
    }
  }

  clear() {
    this.store.clear();
  }

  get size() {
    return this.store.size;
  }
}

module.exports = { TtlCache };

// Jednostavan limit u memoriji po ključu (IP hash) sa kliznim prozorom.
// Dovoljan za jednu instancu backenda (vidi #3); tačni limiti za prijave su u bazi (KTD10).
export function createLimiter(opts: { max: number; windowMs: number; maxKeys?: number }) {
  const hits = new Map<string, number[]>();
  const maxKeys = opts.maxKeys ?? 10_000;

  return {
    // true = zahtjev je preko limita i ne broji se
    limited(key: string, now = Date.now()): boolean {
      const list = (hits.get(key) ?? []).filter((t) => now - t < opts.windowMs);
      if (list.length >= opts.max) {
        hits.set(key, list);
        return true;
      }
      list.push(now);
      hits.set(key, list);
      // Mapa ne smije rasti bez granice
      if (hits.size > maxKeys) hits.clear();
      return false;
    },
    reset() {
      hits.clear();
    },
  };
}

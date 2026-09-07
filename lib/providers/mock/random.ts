/**
 * Deterministic pseudo-randomness for MockProvider. Every generated number
 * must be reproducible from MOCK_SEED alone so that `pnpm sync` run twice
 * produces byte-identical output — that's what makes the sync engine
 * idempotent in practice, not just "no duplicate rows".
 */

/** FNV-1a string hash -> 32-bit unsigned seed. */
function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32 PRNG: same seed -> same infinite sequence of [0, 1) floats. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A fresh RNG scoped to one logical key, e.g. `rngFor(MOCK_SEED, accountId, "followers")`.
 * Keying by parts (rather than sharing one global RNG) means the value for
 * any one thing never depends on what else has been generated before it.
 */
export function rngFor(...parts: string[]): () => number {
  return mulberry32(hashSeed(parts.join("|")));
}

export function randomInRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function randomIntInRange(rng: () => number, min: number, max: number): number {
  return Math.floor(randomInRange(rng, min, max + 1));
}

/** Picks one element deterministically — NOT uniform-safe for tiny arrays with bias concerns, fine for mock flavor text. */
export function pick<T>(rng: () => number, items: readonly T[]): T {
  const item = items[randomIntInRange(rng, 0, items.length - 1)];
  if (item === undefined) {
    throw new RangeError("pick() called with an empty array");
  }
  return item;
}

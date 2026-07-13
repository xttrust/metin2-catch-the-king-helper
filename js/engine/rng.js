// Seeded RNG (mulberry32): fast, deterministic, good enough for simulation.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Derive a fresh stream from a base seed and an index (for common random
// numbers across solver A/B comparisons).
export function streamSeed(base, index) {
  let h = (base ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ index, 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

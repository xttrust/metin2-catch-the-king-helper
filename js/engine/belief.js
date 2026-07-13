// Probabilistic knowledge derived from observations.
//
// Flash events only constrain where the 5s are; revealed values only
// constrain the remaining multiset. Conditioned on a valid 5-placement, the
// remaining non-5 values are an exchangeable multiset over the other hidden
// cells, so the exact posterior factorizes:
//   uniform over valid 5-placements  ×  uniform multiset permutation.
// That makes exact per-cell probabilities and exact sampling cheap: with at
// most three 5s there are at most C(25,3) = 2300 placements to enumerate.

import { KING } from './rules.js';
import { popcount, bits, NEIGHBOR_MASKS } from './bitboard.js';
import { hiddenMask } from './game.js';

function revealed5Mask(state) {
  let m = 0;
  for (let i = 0; i < 25; i++) {
    if (state.values[i] === 5 && (state.revealed & (1 << i))) m |= 1 << i;
  }
  return m;
}

// Resolve stored event-time constraints against the current board.
// Each constraint mask M meant ">=1 of these then-face-down cells is a 5".
// If a cell of M has since been revealed as a 5, the constraint is
// discharged; otherwise it must be satisfied by the still-hidden cells of M
// that are not excluded by no-flash knowledge.
export function activeConstraints(state) {
  const hidden = hiddenMask(state);
  const fives = revealed5Mask(state);
  const candidates = hidden & ~state.notFive;
  const masks = [];
  for (const m of state.constraints) {
    if (m & fives) continue; // explained by a since-revealed 5
    const eff = m & candidates;
    if (eff === 0) return { masks: null, candidates, inconsistent: true };
    masks.push(eff);
  }
  return { masks, candidates, inconsistent: false };
}

// All placements (bitmasks) of the remaining face-down 5s consistent with
// every observation. Empty array means the recorded inputs are contradictory.
export function enumerate5Placements(state) {
  const { masks, candidates, inconsistent } = activeConstraints(state);
  if (inconsistent) return [];
  const k = state.remaining[5];
  if (k === 0) return masks.length === 0 ? [0] : [];
  const cells = bits(candidates);
  if (cells.length < k) return [];
  const placements = [];
  const choose = (start, left, acc) => {
    if (left === 0) {
      for (const m of masks) {
        if ((m & acc) === 0) return;
      }
      placements.push(acc);
      return;
    }
    for (let i = start; i <= cells.length - left; i++) {
      choose(i + 1, left - 1, acc | (1 << cells[i]));
    }
  };
  choose(0, k, 0);
  return placements;
}

// P(cell is a face-down 5) for every cell, as a Float64Array(25).
// Optionally pass precomputed placements to avoid re-enumeration.
export function fiveProbabilities(state, placements = enumerate5Placements(state)) {
  const p = new Float64Array(25);
  if (!placements.length) return p;
  for (const pl of placements) {
    let m = pl;
    while (m) {
      const b = m & -m;
      m ^= b;
      p[31 - Math.clz32(b)] += 1;
    }
  }
  for (let i = 0; i < 25; i++) p[i] /= placements.length;
  return p;
}

// P(a face-down 5 is on or adjacent to each cell), as a Float64Array(25) —
// the "5-zone" danger behind the board's green/red safety tint. Exact over
// the enumerated placements, like fiveProbabilities.
export function fiveZoneRisk(state, placements = enumerate5Placements(state)) {
  const r = new Float64Array(25);
  if (!placements.length) return r;
  for (let i = 0; i < 25; i++) {
    const zone = NEIGHBOR_MASKS[i] | (1 << i);
    let hits = 0;
    for (const pl of placements) {
      if (pl & zone) hits++;
    }
    r[i] = hits / placements.length;
  }
  return r;
}

// Exact P(cell = v) for hidden cells: dist[cell * 7 + v].
export function valueDistribution(state, placements = enumerate5Placements(state)) {
  const dist = new Float64Array(25 * 7);
  const p5 = fiveProbabilities(state, placements);
  const hidden = hiddenMask(state);
  const hiddenCount = popcount(hidden);
  const nonFiveHidden = hiddenCount - state.remaining[5];
  for (let cell = 0; cell < 25; cell++) {
    if (!(hidden & (1 << cell))) continue;
    dist[cell * 7 + 5] = p5[cell];
    if (nonFiveHidden > 0) {
      const rest = 1 - p5[cell];
      for (const v of [1, 2, 3, 4, KING]) {
        dist[cell * 7 + v] = (rest * state.remaining[v]) / nonFiveHidden;
      }
    }
  }
  return dist;
}

// Sanity check for user input: are the recorded observations consistent?
export function validate(state) {
  for (let v = 1; v <= KING; v++) {
    if (state.remaining[v] < 0) {
      return { ok: false, reason: 'counts', value: v };
    }
  }
  if (enumerate5Placements(state).length === 0 && !state.over) {
    // With 0 remaining fives and no active constraints this returns [0], so
    // an empty result always signals contradictory flash observations.
    return { ok: false, reason: 'flash' };
  }
  return { ok: true };
}

// Draw a full board consistent with the observations: exact posterior sample.
// `rng()` returns a float in [0, 1). Pass cached placements in hot loops.
export function sampleBoard(state, rng, placements = enumerate5Placements(state)) {
  if (!placements.length) throw new Error('inconsistent state: no valid 5-placement');
  const truth = state.values.slice();
  const placement = placements[(rng() * placements.length) | 0];
  const pool = [];
  for (const v of [1, 2, 3, 4, KING]) {
    for (let n = 0; n < state.remaining[v]; n++) pool.push(v);
  }
  // Fisher-Yates shuffle of the non-5 pool.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    const t = pool[i];
    pool[i] = pool[j];
    pool[j] = t;
  }
  let pi = 0;
  let hidden = hiddenMask(state);
  while (hidden) {
    const b = hidden & -hidden;
    hidden ^= b;
    const cell = 31 - Math.clz32(b);
    truth[cell] = placement & b ? 5 : pool[pi++];
  }
  return truth;
}

// Deal a brand-new random board (practice mode): uniform shuffle of the full
// 25-card multiset.
export function dealBoard(rng) {
  const deck = [];
  for (let v = 1; v <= KING; v++) {
    for (let n = 0; n < [0, 7, 4, 5, 5, 3, 1][v]; n++) deck.push(v);
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    const t = deck[i];
    deck[i] = deck[j];
    deck[j] = t;
  }
  return Int8Array.from(deck);
}

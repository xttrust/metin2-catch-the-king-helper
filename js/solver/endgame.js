// Exact endgame solver: belief-state expectimax over the true posterior,
// maximizing P(final score >= goal) — not expected score, which is the wrong
// objective near a chest threshold.
//
// States carry their own observation history, so the belief update is exact:
// applying reveal(cell, value, flash) to a cloned state IS the posterior.
// Memoization keys on the full observable situation; a node budget guards
// against blow-ups (caller falls back to rollouts when null is returned).

import { GOLD_THRESHOLD, HAND_SEQUENCE, KING, POINTS, compare } from '../engine/rules.js';
import { NEIGHBOR_MASKS, LINE_COUNT, popcount, bits } from '../engine/bitboard.js';
import {
  cloneState,
  reveal,
  catchAt,
  hiddenMask,
  catchableMask,
  hasRevealed5Neighbor,
} from '../engine/game.js';
import { enumerate5Placements, activeConstraints } from '../engine/belief.js';

class Budget {
  constructor(limit) {
    this.limit = limit;
    this.used = 0;
  }
  spend() {
    if (++this.used > this.limit) throw budgetExceeded;
  }
}
const budgetExceeded = new Error('endgame budget exceeded');

// True upper bound on the final score from here.
function optimisticMax(state) {
  let max = state.score;
  for (let v = 1; v <= KING; v++) max += state.remaining[v] * POINTS[v];
  let unscored = state.revealed & ~state.scored;
  while (unscored) {
    const b = unscored & -unscored;
    unscored ^= b;
    max += POINTS[state.values[31 - Math.clz32(b)]];
  }
  max += (LINE_COUNT - popcount(state.bingos)) * 10;
  return max;
}

function stateKey(state) {
  const { masks } = activeConstraints(state);
  const c = masks ? masks.slice().sort((a, b) => a - b).join('.') : 'x';
  return (
    state.revealed +
    ',' +
    state.scored +
    ',' +
    state.handIndex +
    ',' +
    Math.min(state.score, 10000) +
    ',' +
    state.notFive +
    ',' +
    c +
    ',' +
    state.values.join('')
  );
}

// Probability buckets for revealing `cell`: is it a 5, and does it flash?
function revealOutcomes(state, placements, cell) {
  const N = placements.length;
  const bit = 1 << cell;
  const nbr = NEIGHBOR_MASKS[cell] & hiddenMask(state) & ~bit;
  let n5f = 0;
  let n5q = 0;
  let nof = 0;
  let noq = 0;
  for (const pl of placements) {
    if (pl & bit) {
      if (pl & nbr) n5f++;
      else n5q++;
    } else if (pl & nbr) nof++;
    else noq++;
  }
  const hidden = popcount(hiddenMask(state));
  const nonFiveHidden = hidden - state.remaining[5];
  const out = [];
  if (n5f) out.push({ value: 5, flashed: true, p: n5f / N });
  if (n5q) out.push({ value: 5, flashed: false, p: n5q / N });
  if (nonFiveHidden > 0 && nof + noq > 0) {
    for (const v of [1, 2, 3, 4, KING]) {
      const q = state.remaining[v] / nonFiveHidden;
      if (!q) continue;
      if (nof) out.push({ value: v, flashed: true, p: (nof / N) * q });
      if (noq) out.push({ value: v, flashed: false, p: (noq / N) * q });
    }
  }
  return out;
}

function value(state, goal, memo, budget) {
  if (state.score >= goal) return 1;
  if (state.over) return 0;
  if (optimisticMax(state) < goal) return 0;
  budget.spend();

  const key = stateKey(state);
  const hit = memo.get(key);
  if (hit !== undefined) return hit;

  const placements = enumerate5Placements(state);
  const hand = HAND_SEQUENCE[state.handIndex];
  let best = 0;

  // Catches.
  for (const cell of bits(catchableMask(state))) {
    const v = state.values[cell];
    if (compare(hand, v) === 'lose') continue;
    if (hand === 5 && state.flags.captureAppliesToCatch) {
      // Split on whether a hidden neighbor is a 5 (revealed-5 => certain).
      if (
        state.flags.captureOnRevealed5Neighbor &&
        hasRevealed5Neighbor(state, cell)
      ) {
        continue; // certain capture: strictly pointless
      }
      const nbr = NEIGHBOR_MASKS[cell] & hiddenMask(state);
      let nCap = 0;
      for (const pl of placements) {
        if (pl & nbr) nCap++;
      }
      const pCap = placements.length ? nCap / placements.length : 0;
      let q = 0;
      if (pCap > 0) {
        const sim = cloneState(state);
        catchAt(sim, cell, { captured: true });
        q += pCap * value(sim, goal, memo, budget);
      }
      if (pCap < 1) {
        const sim = cloneState(state);
        catchAt(sim, cell, { captured: false });
        q += (1 - pCap) * value(sim, goal, memo, budget);
      }
      if (q > best) best = q;
      if (best >= 1) break;
      continue;
    }
    const sim = cloneState(state);
    catchAt(sim, cell, {});
    const q = value(sim, goal, memo, budget);
    if (q > best) best = q;
    if (best >= 1) break;
  }

  // Reveals.
  if (best < 1) {
    for (const cell of bits(hiddenMask(state))) {
      const outcomes = revealOutcomes(state, placements, cell);
      let q = 0;
      let remaining = 1;
      for (const o of outcomes) {
        // Upper-bound cut: even if all remaining probability mass wins,
        // can this move still beat the current best?
        if (q + remaining < best) break;
        const sim = cloneState(state);
        reveal(sim, cell, o.value, o.flashed);
        q += o.p * value(sim, goal, memo, budget);
        remaining -= o.p;
      }
      if (q > best) best = q;
      if (best >= 1) break;
    }
  }

  memo.set(key, best);
  return best;
}

// Returns {move, p} for the best move, or null when the position is too big
// for the node budget (caller falls back to a different solver).
export function endgameSearch(state, options = {}) {
  const goal = options.goal ?? GOLD_THRESHOLD;
  const nodeBudget = options.nodeBudget ?? 400000;
  if (state.over) return null;
  const budget = new Budget(nodeBudget);
  const memo = new Map();
  const placements = enumerate5Placements(state);
  if (!placements.length) return null;
  const hand = HAND_SEQUENCE[state.handIndex];

  let bestMove = null;
  let bestP = -1;
  try {
    for (const cell of bits(catchableMask(state))) {
      const v = state.values[cell];
      if (compare(hand, v) === 'lose') continue;
      if (hand === 5 && state.flags.captureAppliesToCatch) {
        if (
          (state.flags.captureOnRevealed5Neighbor && hasRevealed5Neighbor(state, cell)) ||
          placements.some((pl) => pl & (NEIGHBOR_MASKS[cell] & hiddenMask(state)))
        ) {
          continue; // any capture risk on a catch: skip as a root move
        }
      }
      const sim = cloneState(state);
      catchAt(sim, cell, {});
      const p = value(sim, goal, memo, budget);
      if (p > bestP) {
        bestP = p;
        bestMove = { kind: 'catch', cell };
      }
    }
    for (const cell of bits(hiddenMask(state))) {
      const outcomes = revealOutcomes(state, placements, cell);
      let q = 0;
      for (const o of outcomes) {
        const sim = cloneState(state);
        reveal(sim, cell, o.value, o.flashed);
        q += o.p * value(sim, goal, memo, budget);
      }
      if (q > bestP) {
        bestP = q;
        bestMove = { kind: 'reveal', cell };
      }
    }
  } catch (e) {
    if (e === budgetExceeded) return null;
    throw e;
  }
  if (!bestMove) return null;
  return { move: bestMove, p: bestP, nodes: budget.used };
}

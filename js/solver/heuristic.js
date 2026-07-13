// Baseline heuristic policy.
//
// The economics of the game: revealed cards below a future hand card are
// almost always caught eventually (chain-catches are free actions that never
// end the turn), so nearly every revealed card's points are collected sooner
// or later. Score therefore tracks TOTAL REVEALED VALUE, and good play
// maximizes the number of reveals (turn-extending chains) while steering the
// exceptions: 5s (only the single 5-tie can score one), the King (only the
// K-hand scores it, +100), bingo timing, and 5-turn safety.
//
// Move value =
//     immediate expected points (incl. deferred "fodder" value of a lose)
//   + P(chain) x expected value of the rest of the turn
//   + bingo progress shaping
//   + exact Shannon information gain about the 5-placement
//   + preservation of safe flip targets for the 5-turn

import { HAND_SEQUENCE, KING, POINTS, GOLD_THRESHOLD, compare } from '../engine/rules.js';
import {
  NEIGHBOR_MASKS,
  LINE_MASKS,
  CELL_LINES,
  popcount,
  bits,
} from '../engine/bitboard.js';
import { hiddenMask, catchableMask, hasRevealed5Neighbor } from '../engine/game.js';
import { enumerate5Placements, fiveProbabilities } from '../engine/belief.js';

// 0-indexed inner corners R2C2, R2C4, R4C2, R4C4: their flash observations
// localize every possible 5 on the board.
export const OPENER_CELLS = [6, 8, 16, 18];

// Tuned via tools/tune.js random search plus paired A/B against the
// mechanisms of the jogoe reference solver (see README for methodology);
// do not hand-edit without re-benchmarking.
export const DEFAULT_WEIGHTS = {
  chain: 3.194, // scale on the turn-continuation value
  fodderLow: 0.373, // deferred value of a lost reveal that later hands chain
  fodderTie: 0.008, // ... when only an equal hand card remains to tie it
  fodderKing: 0.673, // a revealed King is a near-guaranteed 100 for the K-hand
  fodderDead: 0.05, // nothing left that could ever catch it
  bingoComplete: 1.941, // completing a line right now
  bingoProgress: 0, // partial-line credit: sum of (othersDone/4)^2, dead-line filtered
  info: 3.936, // bits of information about the 5-placement
  fiveReserve: 58.143, // keep safe flip targets for the 5-turn
  catchBonus: 4.47, // catches are certain; tiny nudge over equal-EV flips
  tieCatch: -20.568, // bias against banking the turn via a tie-catch
  tieDominated: 0, // 1 = score dominated tie-catches at 0 (a later hand chains them free)
  // K-hunt bonus per unit P(King): min(kHuntMax, kHuntBase + kHuntSlope * gap-to-gold).
  // (base 0 / slope 25/350 / max 25 reproduces the legacy kHunt=25 shape.)
  kHuntBase: 0,
  kHuntSlope: 25 / 350,
  kHuntMax: 25,
  reserve5Ev: 0, // 1 = price safe/deduced-5 reveals at (ev now − ev on the 5-turn)
  openerExit: 0, // 1 = abandon the opener once every possible 5 is flash-informed
};

// K-hunt weight: locating the K converts the K-turn into a guaranteed +100,
// worth more the further we are from gold.
function kHuntWeight(state, weights) {
  const gap = Math.max(0, GOLD_THRESHOLD - state.score);
  return Math.min(weights.kHuntMax, weights.kHuntBase + weights.kHuntSlope * gap);
}

// --- shared per-decision context -------------------------------------------

export function buildContext(state) {
  const placements = enumerate5Placements(state);
  const total = placements.length || 1;
  const p5 = fiveProbabilities(state, placements);
  const hidden = hiddenMask(state);
  const hiddenCount = popcount(hidden);
  const nonFiveHidden = hiddenCount - state.remaining[5];
  // P(cell = v) for hidden cells, exact (see belief.js).
  const pVal = (cell, v) => {
    if (v === 5) return p5[cell];
    if (nonFiveHidden <= 0) return 0;
    return ((1 - p5[cell]) * state.remaining[v]) / nonFiveHidden;
  };
  return { placements, total, p5, hidden, hiddenCount, nonFiveHidden, pVal };
}

// P(no face-down 5 within the neighborhood of `cell`), from the placements.
function pFlashFree(state, ctx, cell) {
  const nbrHidden = NEIGHBOR_MASKS[cell] & ctx.hidden;
  if (!nbrHidden || state.remaining[5] === 0) return 1;
  let free = 0;
  for (const pl of ctx.placements) {
    if ((pl & nbrHidden) === 0) free++;
  }
  return free / ctx.total;
}

// Is `cell` a certainly-safe flip for the hand 5 right now?
export function safeForFive(state, ctx, cell) {
  if (state.flags.captureOnRevealed5Neighbor && hasRevealed5Neighbor(state, cell)) {
    return false;
  }
  const nbrHidden = NEIGHBOR_MASKS[cell] & ctx.hidden;
  if (!nbrHidden) return true;
  for (const pl of ctx.placements) {
    if (pl & nbrHidden) return false;
  }
  return true;
}

// Exact expected information gain (bits) about the 5-placement from
// revealing `cell`: partition placements by the observable outcome
// (is the cell itself a 5, did it flash).
function infoGain(state, ctx, cell) {
  if (state.remaining[5] === 0 || ctx.total <= 1) return 0;
  const bit = 1 << cell;
  const nbrHidden = NEIGHBOR_MASKS[cell] & ctx.hidden & ~bit;
  let n00 = 0;
  let n01 = 0;
  let n10 = 0;
  let n11 = 0;
  for (const pl of ctx.placements) {
    const is5 = (pl & bit) !== 0;
    const flash = (pl & nbrHidden) !== 0;
    if (is5) {
      if (flash) n11++;
      else n10++;
    } else if (flash) n01++;
    else n00++;
  }
  const N = ctx.total;
  let h = 0;
  for (const n of [n00, n01, n10, n11]) {
    if (n > 0) h += (n / N) * Math.log2(n);
  }
  return Math.log2(N) - h;
}

// Deferred value factor for a card of value `v` left revealed-unscored after
// this turn: can any later hand still collect it?
function fodderGamma(state, v, weights) {
  const rest = HAND_SEQUENCE; // scan hands strictly after the current one
  for (let i = state.handIndex + 1; i < rest.length; i++) {
    const h = rest[i];
    if (h === KING) {
      if (v === KING) return weights.fodderKing;
      continue;
    }
    if (h > v) return weights.fodderLow;
    if (h === v) return weights.fodderTie;
  }
  return weights.fodderDead;
}

// Board-level expected gain of one further reveal this turn, and the chance
// it chains again — used for the geometric turn-continuation value.
function turnContinuation(state, ctx, hand, weights) {
  if (ctx.hiddenCount === 0) return { cont: 0, pChainAvg: 0 };
  let g = 0;
  let c = 0;
  const denom5 = ctx.hiddenCount;
  for (let v = 1; v <= KING; v++) {
    const count = state.remaining[v];
    if (!count) continue;
    const q = count / denom5;
    const cmp = compare(hand, v);
    if (cmp === 'chain') {
      g += q * POINTS[v];
      c += q;
    } else if (cmp === 'score') {
      g += q * POINTS[v];
    } else {
      g += q * POINTS[v] * fodderGamma(state, v, weights);
    }
  }
  // Hand-5 turns get cut short by captures on unsafe flips; damp the chain.
  if (hand === 5 && state.remaining[5] > 0) c *= 0.6;
  const cont = (g * c) / (1 - Math.min(c, 0.92));
  return { cont, pChainAvg: c };
}

// Is a revealed-unscored cell permanently unscoreable? Its bingo lines can
// then never complete, so progress credit toward them is phantom.
// (Learned from the reference solver's dead-line filter.)
function cellPermanentlyDead(state, cell) {
  const v = state.values[cell];
  if (v === KING) return false; // the K-hand comes last; alive until game end
  const h = state.handIndex;
  if (HAND_SEQUENCE.lastIndexOf(v) >= h) return false; // a same-value tie remains
  if (v === 5) return true; // only the 5-tie can ever score a 5
  if (v < 4 && h <= 9) return false; // hands 2-4 still chain-catch it freely
  if (h > 10) return true; // past the 5-hand: nothing left that beats it
  // Only the hand-5 chain remains; an adjacent revealed 5 makes it
  // permanently capture-unsafe.
  return state.flags.captureOnRevealed5Neighbor && hasRevealed5Neighbor(state, cell);
}

// Bitmask of revealed-unscored cells that can never score.
function deadCellMask(state) {
  let mask = 0;
  for (const cell of bits(catchableMask(state))) {
    if (cellPermanentlyDead(state, cell)) mask |= 1 << cell;
  }
  return mask;
}

// Bingo shaping for the lines through `cell` if it gets scored: how many
// lines complete right now, plus partial credit sum((othersDone/4)^2) over
// the incomplete live lines (squared so near-complete lines dominate).
function bingoTerms(state, cell, deadMask) {
  let progress = 0;
  let complete = 0;
  let lines = CELL_LINES[cell] & ~state.bingos;
  while (lines) {
    const lbit = lines & -lines;
    lines ^= lbit;
    const li = 31 - Math.clz32(lbit);
    if (LINE_MASKS[li] & deadMask) continue; // phantom line: can never complete
    const done = popcount(LINE_MASKS[li] & state.scored);
    if (done >= 4) complete += 1;
    else progress += (done / 4) * (done / 4);
  }
  return { progress, complete };
}

// --- candidate scoring -------------------------------------------------------

// Score every legal, non-dominated move. Returns array of
// {kind, cell, score, terms} sorted best-first.
export function rankMoves(state, weights = DEFAULT_WEIGHTS, ctx = buildContext(state)) {
  const hand = HAND_SEQUENCE[state.handIndex];
  const out = [];
  const fiveTurnPending = state.handIndex <= 10 && state.remaining[5] > 0;
  const { cont } = turnContinuation(state, ctx, hand, weights);
  const deadMask = weights.bingoProgress ? deadCellMask(state) : 0;
  const kHuntW = kHuntWeight(state, weights);

  // Count certainly-safe five targets to know how scarce they are.
  let safeFiveCells = 0;
  if (fiveTurnPending && state.handIndex < 10) {
    for (const c of bits(ctx.hidden)) {
      if (safeForFive(state, ctx, c)) safeFiveCells++;
    }
  }

  // -- reveals
  for (const cell of bits(ctx.hidden)) {
    const terms = {};
    let pCapture = 0;
    if (hand === 5) {
      if (state.flags.captureOnRevealed5Neighbor && hasRevealed5Neighbor(state, cell)) {
        pCapture = 1;
      } else {
        pCapture = 1 - pFlashFree(state, ctx, cell);
      }
    }
    let pChain = 0;
    let pScore = 0;
    let ev = 0;
    for (let v = 1; v <= KING; v++) {
      const p = ctx.pVal(cell, v);
      if (!p) continue;
      const cmp = compare(hand, v);
      if (cmp === 'chain') {
        pChain += p;
        ev += p * POINTS[v];
      } else if (cmp === 'score') {
        pScore += p;
        ev += p * POINTS[v];
      } else {
        // A lost reveal is fodder: later hands usually collect it.
        ev += p * POINTS[v] * fodderGamma(state, v, weights);
      }
    }
    if (hand === 5 && pCapture > 0) {
      // Capture preempts scoring; the cell still ends up revealed-unscored,
      // worth its fodder value. Approximate independence.
      const fodderEv = (() => {
        let f = 0;
        for (let v = 1; v <= KING; v++) {
          const p = ctx.pVal(cell, v);
          if (p) f += p * POINTS[v] * fodderGamma(state, v, weights);
        }
        return f;
      })();
      ev = (1 - pCapture) * ev + pCapture * fodderEv;
      pChain *= 1 - pCapture;
      pScore *= 1 - pCapture;
    }
    terms.ev = ev;
    terms.chain = weights.chain * pChain * cont;
    const bt = bingoTerms(state, cell, deadMask);
    const pScored = pChain + pScore;
    // Progress credit stays unconditional: even a lost reveal advances its
    // lines once a later hand collects the card as fodder.
    terms.bingo =
      pScored * bt.complete * weights.bingoComplete + bt.progress * weights.bingoProgress;
    terms.info = fiveTurnPending && hand !== 5 ? infoGain(state, ctx, cell) * weights.info : 0;
    // Dynamic King hunt: locating the K locks a guaranteed 100 for the
    // K-turn; worth more the further we are from gold (on top of the static
    // fodderKing share already in the EV).
    terms.king =
      hand !== KING && state.remaining[KING] > 0 ? ctx.pVal(cell, KING) * kHuntW : 0;
    // Safe-for-5 reveals (and deduced 5s) are the 5-turn's food: flipping
    // them now only earns the difference vs letting the 5-turn collect them.
    // Chain and bingo value roughly cancel (both turns get them); info and
    // the K-hunt stay on the "now" side.
    if (
      weights.reserve5Ev &&
      hand !== 5 &&
      fiveTurnPending &&
      state.handIndex < 10 &&
      (ctx.p5[cell] >= 0.999 || safeForFive(state, ctx, cell))
    ) {
      let evLater = 0;
      for (let v = 1; v <= 5; v++) evLater += ctx.pVal(cell, v) * POINTS[v];
      terms.reserve = -weights.reserve5Ev * evLater;
      terms.chain = 0;
      out.push({
        kind: 'reveal',
        cell,
        score: terms.ev + terms.reserve + terms.bingo + terms.info + terms.king,
        terms,
      });
      continue;
    }
    // Burning one of the few safe 5-flip targets before the 5-turn.
    let reserve = 0;
    if (fiveTurnPending && state.handIndex < 10 && safeFiveCells > 0 && safeFiveCells <= 4) {
      if (safeForFive(state, ctx, cell)) {
        reserve = -weights.fiveReserve / safeFiveCells;
      }
    }
    terms.reserve = reserve;
    const score =
      terms.ev + terms.chain + terms.bingo + terms.info + terms.king + terms.reserve;
    out.push({ kind: 'reveal', cell, score, terms });
  }

  // -- catches (only sensible ones: no losing claims, and safe on the 5-turn)
  for (const cell of bits(catchableMask(state))) {
    const v = state.values[cell];
    const cmp = compare(hand, v);
    if (cmp === 'lose') continue;
    if (hand === 5 && state.flags.captureAppliesToCatch && !safeForFive(state, ctx, cell)) {
      continue;
    }
    // A tie-catch is dominated when a later hand chain-catches the same cell
    // for free (without ending this turn): hands 2/3 always leave a higher
    // hand; hand 4 does iff the cell stays provably 5-safe.
    if (weights.tieDominated && cmp === 'score' && hand !== KING) {
      const laterChain =
        hand === 2 || hand === 3 || (hand === 4 && safeForFive(state, ctx, cell));
      if (laterChain) {
        out.push({ kind: 'catch', cell, score: 0, terms: { ev: POINTS[v], dominated: true } });
        continue;
      }
    }
    const terms = {};
    terms.ev = POINTS[v];
    // A chain-catch is a free action: certain points and the turn continues
    // with every option intact. A tie-catch banks the turn.
    terms.chain = cmp === 'chain' ? weights.chain * cont : weights.tieCatch;
    const bt = bingoTerms(state, cell, deadMask);
    terms.bingo = bt.complete * weights.bingoComplete + bt.progress * weights.bingoProgress;
    terms.info = 0;
    terms.reserve = 0;
    const score =
      terms.ev + terms.chain + terms.bingo + weights.catchBonus;
    out.push({ kind: 'catch', cell, score, terms });
  }

  out.sort((a, b) => b.score - a.score);
  return out;
}

// The board King's cell if it is known exactly: either revealed-unscored, or
// hidden with probability 1. Returns -1 otherwise.
export function knownKingCell(state, ctx) {
  for (let i = 0; i < 25; i++) {
    const bit = 1 << i;
    if (state.revealed & bit && !(state.scored & bit) && state.values[i] === KING) {
      return i;
    }
  }
  if (state.remaining[KING] === 1 && ctx.nonFiveHidden === 1) {
    // Exactly one hidden non-5 cell left: it is the King.
    for (const c of bits(ctx.hidden)) {
      if (ctx.p5[c] < 1e-9) return c;
    }
  }
  return -1;
}

// Has every hidden cell that could still be a 5 already been "seen" by some
// revealed neighbor's flash observation? If so the opener has nothing left
// to learn about the 5-map and can hand over to the EV heuristic early.
export function fivesFullyInformed(state, ctx) {
  if (state.remaining[5] === 0) return true;
  for (const c of bits(ctx.hidden)) {
    const p = ctx.p5[c];
    if (p <= 0.001 || p >= 0.999) continue;
    if (!(NEIGHBOR_MASKS[c] & state.revealed)) return false;
  }
  return true;
}

// --- the policy --------------------------------------------------------------

// Deterministic baseline policy: opener first, then best heuristic move.
export function heuristicPolicy(state, weights = DEFAULT_WEIGHTS) {
  // Fixed opener on the 1-hands: the four inner corners, skipping any that
  // are already revealed.
  if (state.handIndex < OPENER_CELLS.length + 1) {
    const ctx = buildContext(state);
    if (!(weights.openerExit && fivesFullyInformed(state, ctx))) {
      for (const cell of OPENER_CELLS) {
        if (!(state.revealed & (1 << cell))) {
          return { kind: 'reveal', cell };
        }
      }
    }
    const ranked = rankMoves(state, weights, ctx);
    if (!ranked.length) return null;
    return { kind: ranked[0].kind, cell: ranked[0].cell };
  }
  const ranked = rankMoves(state, weights);
  if (!ranked.length) return null;
  return { kind: ranked[0].kind, cell: ranked[0].cell };
}

// Observation-level game state and transitions. No DOM, no randomness.
//
// The state stores exactly what the player can know: revealed values, flash
// observations, scores, and the hand position. Flash knowledge is recorded at
// event time (which neighbors were face-down when the flash happened), which
// is strictly more precise than re-deriving it from the current board.
//
// The same transitions serve the live tracker (user supplies value + flash),
// the practice simulator, and solver rollouts (truth array supplies both).

import {
  BOARD_COUNTS,
  DEFAULT_RULE_FLAGS,
  FULL_MASK,
  HAND_SEQUENCE,
  HAND_SIZE,
  KING,
  POINTS,
  BINGO_BONUS,
  compare,
} from './rules.js';
import { CELL_LINES, LINE_MASKS, NEIGHBOR_MASKS } from './bitboard.js';

export function newGame(options = {}) {
  return {
    flags: { ...DEFAULT_RULE_FLAGS, ...(options.flags || {}) },
    revealed: 0, // bitmask of face-up cells
    scored: 0, // bitmask of cells whose points were collected
    flashMask: 0, // bitmask of cells that flashed when revealed
    values: new Int8Array(25), // 0 = unknown, 1..6 once revealed
    remaining: BOARD_COUNTS.slice(), // face-down count per value
    handIndex: 0,
    score: 0,
    bingos: 0, // bitmask over the 12 line indices already awarded
    over: false,
    // Deduction knowledge, maintained at event time:
    notFive: 0, // cells known not to be a 5 (from no-flash reveals)
    constraints: [], // bitmasks: ">=1 cell in mask was a face-down 5 then"
    // History of events for undo/redo and blunder review:
    trackHistory: options.trackHistory !== false,
    history: [],
    future: [],
  };
}

export function cloneState(state) {
  return {
    flags: state.flags,
    revealed: state.revealed,
    scored: state.scored,
    flashMask: state.flashMask,
    values: state.values.slice(),
    remaining: state.remaining.slice(),
    handIndex: state.handIndex,
    score: state.score,
    bingos: state.bingos,
    over: state.over,
    notFive: state.notFive,
    constraints: state.constraints.slice(),
    trackHistory: false, // clones are for search/rollouts; no history
    history: [],
    future: [],
  };
}

export function currentHand(state) {
  return state.over ? 0 : HAND_SEQUENCE[state.handIndex];
}

export function hiddenMask(state) {
  return FULL_MASK & ~state.revealed;
}

// Revealed but not yet scored — candidates for a later catch.
export function catchableMask(state) {
  return state.revealed & ~state.scored;
}

function snapshot(state) {
  return {
    revealed: state.revealed,
    scored: state.scored,
    flashMask: state.flashMask,
    values: state.values.slice(),
    remaining: state.remaining.slice(),
    handIndex: state.handIndex,
    score: state.score,
    bingos: state.bingos,
    over: state.over,
    notFive: state.notFive,
    constraints: state.constraints.slice(),
  };
}

function restore(state, snap) {
  state.revealed = snap.revealed;
  state.scored = snap.scored;
  state.flashMask = snap.flashMask;
  state.values = snap.values.slice();
  state.remaining = snap.remaining.slice();
  state.handIndex = snap.handIndex;
  state.score = snap.score;
  state.bingos = snap.bingos;
  state.over = snap.over;
  state.notFive = snap.notFive;
  state.constraints = snap.constraints.slice();
}

// Award any newly completed bingo lines through `cell`. Returns bonus points.
function awardBingos(state, cell) {
  let lines = CELL_LINES[cell] & ~state.bingos;
  let bonus = 0;
  while (lines) {
    const bit = lines & -lines;
    lines ^= bit;
    const li = 31 - Math.clz32(bit);
    if ((state.scored & LINE_MASKS[li]) === LINE_MASKS[li]) {
      state.bingos |= bit;
      bonus += BINGO_BONUS;
    }
  }
  state.score += bonus;
  return bonus;
}

function endTurn(state) {
  state.handIndex += 1;
  if (state.handIndex >= HAND_SIZE) state.over = true;
}

function checkBoardCleared(state) {
  if (state.scored === FULL_MASK) state.over = true;
}

function finishMove(state, event) {
  if (event.outcome !== 'chain') endTurn(state);
  checkBoardCleared(state);
  event.gameOver = state.over;
  if (state.trackHistory) {
    state.history.push(event);
    state.future.length = 0;
  }
  return event;
}

// Does any *revealed* neighbor of `cell` hold a 5?
export function hasRevealed5Neighbor(state, cell) {
  let m = NEIGHBOR_MASKS[cell] & state.revealed;
  while (m) {
    const b = m & -m;
    m ^= b;
    if (state.values[31 - Math.clz32(b)] === 5) return true;
  }
  return false;
}

// Reveal a face-down cell. `value` is 1..6, `flashed` is the observed flash.
// Returns the applied event. Throws on illegal or inconsistent input.
export function reveal(state, cell, value, flashed) {
  if (state.over) throw new Error('game is over');
  const bit = 1 << cell;
  if (state.revealed & bit) throw new Error(`cell ${cell} is already revealed`);
  if (value < 1 || value > KING) throw new Error(`bad value ${value}`);
  if (state.remaining[value] <= 0) {
    throw new Error(`no ${value === KING ? 'K' : value} cards remain face-down`);
  }

  const hand = HAND_SEQUENCE[state.handIndex];
  const hiddenNeighbors = NEIGHBOR_MASKS[cell] & ~state.revealed;
  // A flash is caused by a face-down 5 among the neighbors; with no hidden
  // neighbors left a flash is impossible.
  if (flashed && hiddenNeighbors === 0) {
    throw new Error('flash reported but the cell has no face-down neighbors');
  }

  const snap = state.trackHistory ? snapshot(state) : null;

  // Record deduction knowledge before mutating reveal state.
  if (flashed) {
    // The flashing 5 is not the revealed cell itself; if we are revealing a 5
    // the flash still refers to *another* face-down 5 among the neighbors.
    state.constraints.push(hiddenNeighbors);
  } else {
    state.notFive |= hiddenNeighbors;
  }

  state.revealed |= bit;
  state.values[cell] = value;
  state.remaining[value] -= 1;
  if (flashed) state.flashMask |= bit;

  const event = {
    kind: 'reveal',
    cell,
    value,
    flashed,
    hand,
    handIndex: state.handIndex,
    points: 0,
    bingoBonus: 0,
    snap,
  };

  // Hand-5 capture takes precedence over the value comparison.
  if (hand === 5) {
    const captured =
      flashed ||
      (state.flags.captureOnRevealed5Neighbor && hasRevealed5Neighbor(state, cell));
    if (captured) {
      event.outcome = 'captured';
      return finishMove(state, event);
    }
  }

  const cmp = compare(hand, value);
  event.outcome = cmp;
  if (cmp !== 'lose') {
    event.points = POINTS[value];
    state.score += event.points;
    state.scored |= bit;
    event.bingoBonus = awardBingos(state, cell);
  }
  return finishMove(state, event);
}

// Catch (claim) an already-revealed, unscored cell with the current hand card.
// On the 5-turn the outcome can depend on a hidden neighbor being a 5; when it
// is not deducible from the state, `opts.captured` must say what happened.
export function catchAt(state, cell, opts = {}) {
  if (state.over) throw new Error('game is over');
  const bit = 1 << cell;
  if (!(state.revealed & bit)) throw new Error(`cell ${cell} is not revealed`);
  if (state.scored & bit) throw new Error(`cell ${cell} is already scored`);

  const hand = HAND_SEQUENCE[state.handIndex];
  const value = state.values[cell];
  const snap = state.trackHistory ? snapshot(state) : null;

  const event = {
    kind: 'catch',
    cell,
    value,
    flashed: false,
    hand,
    handIndex: state.handIndex,
    points: 0,
    bingoBonus: 0,
    snap,
  };

  if (hand === 5 && state.flags.captureAppliesToCatch) {
    let captured;
    if (state.flags.captureOnRevealed5Neighbor && hasRevealed5Neighbor(state, cell)) {
      captured = true;
    } else {
      const hiddenNeighbors = NEIGHBOR_MASKS[cell] & ~state.revealed;
      const possible = hiddenNeighbors & ~state.notFive;
      if (possible === 0) captured = false;
      else if (opts.captured === undefined) {
        throw new Error('ambiguous 5-catch: opts.captured required');
      } else captured = opts.captured;
    }
    if (captured) {
      event.outcome = 'captured';
      return finishMove(state, event);
    }
  }

  const cmp = compare(hand, value);
  event.outcome = cmp;
  if (cmp !== 'lose') {
    event.points = POINTS[value];
    state.score += event.points;
    state.scored |= bit;
    event.bingoBonus = awardBingos(state, cell);
  }
  return finishMove(state, event);
}

export function canUndo(state) {
  return state.history.length > 0;
}

export function canRedo(state) {
  return state.future.length > 0;
}

export function undo(state) {
  if (!state.history.length) return null;
  const event = state.history.pop();
  state.future.push(event);
  restore(state, event.snap);
  return event;
}

export function redo(state) {
  if (!state.future.length) return null;
  const event = state.future.pop();
  if (event.kind === 'reveal') {
    // Re-apply without touching history bookkeeping.
    const wasTracking = state.trackHistory;
    state.trackHistory = false;
    reveal(state, event.cell, event.value, event.flashed);
    state.trackHistory = wasTracking;
  } else {
    const wasTracking = state.trackHistory;
    state.trackHistory = false;
    catchAt(state, event.cell, { captured: event.outcome === 'captured' });
    state.trackHistory = wasTracking;
  }
  state.history.push(event);
  return event;
}

// Plain-object snapshot for structured clone across the Worker boundary.
export function serializeState(state) {
  return {
    flags: state.flags,
    revealed: state.revealed,
    scored: state.scored,
    flashMask: state.flashMask,
    values: Array.from(state.values),
    remaining: state.remaining.slice(),
    handIndex: state.handIndex,
    score: state.score,
    bingos: state.bingos,
    over: state.over,
    notFive: state.notFive,
    constraints: state.constraints.slice(),
  };
}

export function deserializeState(obj) {
  const state = newGame({ flags: obj.flags, trackHistory: false });
  state.revealed = obj.revealed;
  state.scored = obj.scored;
  state.flashMask = obj.flashMask;
  state.values = Int8Array.from(obj.values);
  state.remaining = obj.remaining.slice();
  state.handIndex = obj.handIndex;
  state.score = obj.score;
  state.bingos = obj.bingos;
  state.over = obj.over;
  state.notFive = obj.notFive;
  state.constraints = obj.constraints.slice();
  return state;
}

// ---------------------------------------------------------------------------
// Simulator helpers: apply moves against a known truth board (practice mode,
// rollouts, benchmarks). `truth` is an Int8Array(25) of values 1..6.

export function truthFlash(state, truth, cell) {
  let m = NEIGHBOR_MASKS[cell] & ~state.revealed;
  while (m) {
    const b = m & -m;
    m ^= b;
    if (truth[31 - Math.clz32(b)] === 5) return true;
  }
  return false;
}

export function simReveal(state, truth, cell) {
  return reveal(state, cell, truth[cell], truthFlash(state, truth, cell));
}

export function simCatch(state, truth, cell) {
  let captured;
  if (HAND_SEQUENCE[state.handIndex] === 5 && state.flags.captureAppliesToCatch) {
    captured =
      (state.flags.captureOnRevealed5Neighbor && hasRevealed5Neighbor(state, cell)) ||
      truthFlash(state, truth, cell);
  }
  return catchAt(state, cell, { captured });
}

// Apply a generic move {kind, cell} against the truth board.
export function simMove(state, truth, move) {
  return move.kind === 'catch'
    ? simCatch(state, truth, move.cell)
    : simReveal(state, truth, move.cell);
}

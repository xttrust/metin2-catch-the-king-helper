// Rollout move selection: one-step policy improvement over the heuristic.
//
// At each non-forced decision, every candidate move is evaluated by Monte
// Carlo: sample full boards from the exact belief posterior, apply the move,
// play the rest of the game with the baseline heuristic, and measure
// P(final score >= 550). The same sampled boards are reused across
// candidates (common random numbers) so comparisons are low-variance.
// By the policy-improvement theorem this cannot be worse than the baseline
// in expectation; in practice it is substantially stronger.

import { GOLD_THRESHOLD, HAND_SEQUENCE, compare } from '../engine/rules.js';
import { bits, popcount } from '../engine/bitboard.js';
import { cloneState, simMove, catchableMask, hiddenMask } from '../engine/game.js';
import { sampleBoard } from '../engine/belief.js';
import { endgameSearch } from './endgame.js';
import {
  DEFAULT_WEIGHTS,
  OPENER_CELLS,
  buildContext,
  fivesFullyInformed,
  heuristicPolicy,
  rankMoves,
  safeForFive,
} from './heuristic.js';

export function playout(state, truth, weights) {
  let guard = 0;
  while (!state.over && guard++ < 300) {
    const move = heuristicPolicy(state, weights);
    if (!move) break;
    simMove(state, truth, move);
  }
  return state.score;
}

// A catch that chains is a free action: certain points, the turn continues,
// and every other option remains available. Taking it immediately is never
// worse, so it needs no rollouts. (5-turn catches must be provably safe.)
export function freeChainCatch(state, ctx) {
  const hand = HAND_SEQUENCE[state.handIndex];
  for (const cell of bits(catchableMask(state))) {
    if (compare(hand, state.values[cell]) !== 'chain') continue;
    if (hand === 5 && state.flags.captureAppliesToCatch && !safeForFive(state, ctx, cell)) {
      continue;
    }
    return { kind: 'catch', cell };
  }
  return null;
}

// Fixed opener move, unless (with openerExit set and a context supplied) the
// 5-placement is already fully flash-informed and the opener has no job left.
export function forcedOpener(state, ctx = null, weights = null) {
  if (state.handIndex < OPENER_CELLS.length + 1) {
    if (weights?.openerExit && ctx && fivesFullyInformed(state, ctx)) return null;
    for (const cell of OPENER_CELLS) {
      if (!(state.revealed & (1 << cell))) {
        return { kind: 'reveal', cell };
      }
    }
  }
  return null;
}

export function makeRolloutPolicy(options = {}) {
  const samples = options.samples ?? 160;
  const topK = options.topK ?? 8;
  const weights = { ...DEFAULT_WEIGHTS, ...(options.weights || {}) };
  const goal = options.goal ?? GOLD_THRESHOLD;
  const endgameHidden = options.endgameHidden ?? 7;
  const endgameBudget = options.endgameBudget ?? 400000;
  const useOpener = options.opener !== false;

  return function rolloutPolicy(state, rng) {
    const ctx = buildContext(state);
    const opener = useOpener ? forcedOpener(state, ctx, weights) : null;
    if (opener) return opener;
    const free = freeChainCatch(state, ctx);
    if (free) return free;

    // Exact search when the board is small enough. When the goal is already
    // decided either way (p ~ 0 or ~ 1), fall through to rollouts, whose
    // score tiebreak keeps playing for maximum points (silver still counts).
    if (popcount(hiddenMask(state)) <= endgameHidden) {
      const exact = endgameSearch(state, { goal, nodeBudget: endgameBudget });
      if (exact && exact.p > 0.001 && exact.p < 0.999) return exact.move;
    }

    const ranked = rankMoves(state, weights, ctx);
    if (!ranked.length) return null;
    if (ranked.length === 1) return { kind: ranked[0].kind, cell: ranked[0].cell };

    // Evaluate candidates on shared sampled boards (common random numbers).
    const evaluate = (cands, nSamples) => {
      const stats = cands.map(() => ({ gold: 0, score: 0 }));
      for (let s = 0; s < nSamples; s++) {
        const truth = sampleBoard(state, rng, ctx.placements);
        for (let i = 0; i < cands.length; i++) {
          const sim = cloneState(state);
          simMove(sim, truth, { kind: cands[i].kind, cell: cands[i].cell });
          const finalScore = playout(sim, truth, weights);
          if (finalScore >= goal) stats[i].gold++;
          stats[i].score += finalScore;
        }
      }
      return stats;
    };
    const argsort = (cands, stats) =>
      cands
        .map((c, i) => ({ c, g: stats[i].gold, s: stats[i].score }))
        .sort((a, b) => b.g - a.g || b.s - a.s);

    // Two-stage selection against the winner's curse: a cheap screening pass
    // over all candidates, then a decisive pass with fresh samples over the
    // finalists only. Early decisions are few and shape the whole game, so
    // they get a larger sample budget.
    const eff = state.handIndex <= 5 ? Math.ceil(samples * 1.5) : samples;
    const screening = ranked.slice(0, topK);
    const s1 = Math.max(24, eff >> 1);
    const pass1 = argsort(screening, evaluate(screening, s1));
    const finalists = pass1.slice(0, 3).map((x) => x.c);
    if (finalists.length === 1) return { kind: finalists[0].kind, cell: finalists[0].cell };
    const pass2 = argsort(finalists, evaluate(finalists, eff));
    return { kind: pass2[0].c.kind, cell: pass2[0].c.cell };
  };
}

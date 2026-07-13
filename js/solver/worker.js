// Solver Web Worker. Runs analysis off the UI thread and replies
// progressively: a fast heuristic pass first, then rollout-refined
// evaluations. Newer requests abort superseded heavy work.

import {
  deserializeState,
  cloneState,
  simMove,
  hiddenMask,
} from '../engine/game.js';
import {
  enumerate5Placements,
  fiveProbabilities,
  adjacentFiveRisk,
  valueDistribution,
  sampleBoard,
  validate,
} from '../engine/belief.js';
import { GOLD_THRESHOLD } from '../engine/rules.js';
import { popcount } from '../engine/bitboard.js';
import {
  DEFAULT_WEIGHTS,
  buildContext,
  rankMoves,
  safeForFive,
} from './heuristic.js';
import { forcedOpener, freeChainCatch, playout } from './rollout.js';
import { endgameSearch } from './endgame.js';
import { mulberry32 } from '../engine/rng.js';

let liveGen = 0;

const yieldNow = () => new Promise((r) => setTimeout(r, 0));

function reasonsFor(move, state, ctx) {
  const reasons = [];
  const t = move.terms || {};
  if (move.kind === 'catch') {
    reasons.push(t.chain > 0 ? 'reason.chainCatch' : 'reason.bankCatch');
  } else {
    if (t.info >= 6) reasons.push('reason.info');
    if (t.chain >= 25) reasons.push('reason.chain');
    if (t.bingo >= 8) reasons.push('reason.bingo');
    if (ctx.pVal(move.cell, 6) >= 0.5) reasons.push('reason.king');
  }
  if (state.handIndex === 10 && move.kind === 'reveal' && safeForFive(state, ctx, move.cell)) {
    reasons.push('reason.safeFive');
  }
  return reasons.slice(0, 2);
}

// Evaluate candidate moves by shared-sample rollouts; chunked and abortable.
async function evaluateCandidates(state, candidates, ctx, gen, samples) {
  const results = candidates.map(() => ({ gold: 0, score: 0, n: 0 }));
  const rng = mulberry32(0xc0ffee ^ (state.revealed * 31 + state.handIndex));
  const batch = 8;
  for (let done = 0; done < samples; done += batch) {
    if (gen !== liveGen) return null; // superseded
    for (let s = 0; s < batch; s++) {
      const truth = sampleBoard(state, rng, ctx.placements);
      for (let i = 0; i < candidates.length; i++) {
        const sim = cloneState(state);
        simMove(sim, truth, { kind: candidates[i].kind, cell: candidates[i].cell });
        const final = playout(sim, truth, DEFAULT_WEIGHTS);
        results[i].n++;
        results[i].score += final;
        if (final >= GOLD_THRESHOLD) results[i].gold++;
      }
    }
    await yieldNow();
  }
  return results;
}

async function analyze(msg) {
  const gen = ++liveGen;
  const state = deserializeState(msg.state);

  const check = validate(state);
  if (!check.ok) {
    postMessage({ type: 'invalid', gen, reqId: msg.reqId, reason: check.reason });
    return;
  }

  const ctx = buildContext(state);
  const p5 = Array.from(fiveProbabilities(state, ctx.placements));
  const risk = Array.from(adjacentFiveRisk(state, ctx.placements));
  const dist = Array.from(valueDistribution(state, ctx.placements));

  if (state.over) {
    postMessage({
      type: 'analysis', phase: 'final', gen, reqId: msg.reqId,
      p5, risk, dist, suggestion: null, top: [], pGold: state.score >= GOLD_THRESHOLD ? 1 : 0,
    });
    return;
  }

  // Fast phase: heuristic ranking, forced moves resolved instantly.
  const opener = forcedOpener(state, ctx, DEFAULT_WEIGHTS);
  const free = opener ? null : freeChainCatch(state, ctx);
  const ranked = rankMoves(state, DEFAULT_WEIGHTS, ctx);
  let fastMove;
  let fastKind = 'heuristic';
  if (opener) {
    fastMove = opener;
    fastKind = 'opener';
  } else if (free) {
    fastMove = free;
    fastKind = 'freeCatch';
  } else if (ranked.length) {
    fastMove = { kind: ranked[0].kind, cell: ranked[0].cell };
  } else {
    fastMove = null;
  }
  const rankedInfo = ranked.slice(0, 3).map((m) => ({
    kind: m.kind,
    cell: m.cell,
    reasons: reasonsFor(m, state, ctx),
  }));
  postMessage({
    type: 'analysis', phase: 'fast', gen, reqId: msg.reqId,
    p5, risk, dist,
    suggestion: fastMove && {
      ...fastMove,
      kind2: fastKind,
      reasons:
        fastKind === 'opener'
          ? ['reason.opener']
          : fastKind === 'freeCatch'
            ? ['reason.chainCatch']
            : rankedInfo[0]?.reasons ?? [],
    },
    top: rankedInfo,
    pGold: null,
  });

  // Forced moves need no refinement, but the gold gauge still does.
  const hidden = popcount(hiddenMask(state));

  // Exact endgame.
  if (hidden <= 6) {
    const exact = endgameSearch(state, {});
    if (exact && gen === liveGen) {
      const useExact = exact.p > 0.001 && exact.p < 0.999;
      postMessage({
        type: 'analysis', phase: 'exact', gen, reqId: msg.reqId,
        p5, risk, dist,
        suggestion: useExact
          ? { ...exact.move, kind2: 'exact', reasons: ['reason.exact'] }
          : undefined, // keep fast suggestion; p is still exact
        top: undefined,
        pGold: exact.p,
        exact: true,
      });
      if (useExact) return;
    }
  }

  // Rollout refinement of the top candidates (skip when the move is forced).
  const candidates = opener || free
    ? [fastMove && { kind: fastMove.kind, cell: fastMove.cell, terms: {} }].filter(Boolean)
    : ranked.slice(0, 4);
  if (!candidates.length) return;
  const samples = msg.samples ?? 96;
  const results = await evaluateCandidates(state, candidates, ctx, gen, samples);
  if (!results || gen !== liveGen) return;
  const scored = candidates.map((c, i) => ({
    kind: c.kind,
    cell: c.cell,
    pGold: results[i].gold / results[i].n,
    meanScore: results[i].score / results[i].n,
    reasons: reasonsFor(c, state, ctx),
  }));
  scored.sort((a, b) => b.pGold - a.pGold || b.meanScore - a.meanScore);
  // Decisive second pass on the top two with fresh samples (winner's-curse
  // guard, mirroring the benchmark solver's two-stage selection).
  if (scored.length > 1 && !(opener || free)) {
    const finalists = scored.slice(0, 2).map((s) => ({ kind: s.kind, cell: s.cell }));
    const r2 = await evaluateCandidates(state, finalists, ctx, gen, samples);
    if (!r2 || gen !== liveGen) return;
    for (let i = 0; i < finalists.length; i++) {
      scored[i].pGold = (scored[i].pGold + r2[i].gold / r2[i].n) / 2;
      scored[i].meanScore = (scored[i].meanScore + r2[i].score / r2[i].n) / 2;
    }
    if (
      scored[1].pGold > scored[0].pGold ||
      (scored[1].pGold === scored[0].pGold && scored[1].meanScore > scored[0].meanScore)
    ) {
      [scored[0], scored[1]] = [scored[1], scored[0]];
    }
  }
  postMessage({
    type: 'analysis', phase: 'full', gen, reqId: msg.reqId,
    p5, risk, dist,
    suggestion: opener || free ? undefined : { kind: scored[0].kind, cell: scored[0].cell, kind2: 'rollout', reasons: scored[0].reasons },
    top: scored,
    pGold: scored[0].pGold,
  });
}

// Grade a finished game: for each decision, compare the chosen move against
// the solver's choice by rollout P(gold).
async function review(msg) {
  const gen = ++liveGen;
  const decisions = msg.decisions; // [{state, move}]
  const samples = msg.samples ?? 64;
  for (let d = 0; d < decisions.length; d++) {
    if (gen !== liveGen) return;
    const state = deserializeState(decisions[d].state);
    const chosen = decisions[d].move;
    const ctx = buildContext(state);
    const ranked = rankMoves(state, DEFAULT_WEIGHTS, ctx);
    const cands = ranked.slice(0, 4);
    // Ensure the chosen move is among the evaluated candidates.
    if (!cands.some((c) => c.kind === chosen.kind && c.cell === chosen.cell)) {
      cands.push({ kind: chosen.kind, cell: chosen.cell, terms: {} });
    }
    const results = await evaluateCandidates(state, cands, ctx, gen, samples);
    if (!results) return;
    let best = 0;
    for (let i = 1; i < cands.length; i++) {
      if (results[i].gold > results[best].gold) best = i;
    }
    const chosenIdx = cands.findIndex(
      (c) => c.kind === chosen.kind && c.cell === chosen.cell
    );
    postMessage({
      type: 'reviewStep', gen, reqId: msg.reqId, index: d,
      chosen: {
        kind: chosen.kind, cell: chosen.cell,
        pGold: results[chosenIdx].gold / results[chosenIdx].n,
      },
      best: {
        kind: cands[best].kind, cell: cands[best].cell,
        pGold: results[best].gold / results[best].n,
      },
      total: decisions.length,
    });
  }
  postMessage({ type: 'reviewDone', gen, reqId: msg.reqId });
}

self.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'analyze') analyze(msg);
  else if (msg.type === 'review') review(msg);
};

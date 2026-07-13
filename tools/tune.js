// Random-search weight tuning for the heuristic (Node-only).
//
//   node tools/tune.js [--gens 30] [--pop 16] [--n 6000] [--seed 1]
//
// Evaluates candidates on a fixed set of boards (common random numbers) so
// comparisons are low-variance, keeps the best, and prints a JS object ready
// to paste into DEFAULT_WEIGHTS. Confirms the winner on a fresh 30k set.

import { newGame, simMove } from '../js/engine/game.js';
import { dealBoard } from '../js/engine/belief.js';
import { mulberry32, streamSeed } from '../js/engine/rng.js';
import { GOLD_THRESHOLD } from '../js/engine/rules.js';
import { DEFAULT_WEIGHTS, heuristicPolicy } from '../js/solver/heuristic.js';

const argv = process.argv;
const opt = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? +argv[i + 1] : dflt;
};
const GENS = opt('gens', 30);
const POP = opt('pop', 16);
const N = opt('n', 6000);
const SEED = opt('seed', 1);

// Which weights to perturb, and their scale.
const TUNABLE = {
  chain: 0.4,
  fodderLow: 0.15,
  fodderTie: 0.2,
  fodderKing: 0.1,
  bingoStep: 8,
  bingoComplete: 6,
  info: 12,
  fiveReserve: 12,
  catchBonus: 3,
  tieCatch: 8,
};

function evalWeights(weights, n, seedBase) {
  let gold = 0;
  let scoreSum = 0;
  for (let i = 0; i < n; i++) {
    const rng = mulberry32(streamSeed(seedBase, i));
    const truth = dealBoard(rng);
    const g = newGame({ trackHistory: false });
    let guard = 0;
    while (!g.over && guard++ < 300) {
      const move = heuristicPolicy(g, weights);
      if (!move) break;
      simMove(g, truth, move);
    }
    if (g.score >= GOLD_THRESHOLD) gold++;
    scoreSum += g.score;
  }
  return { gold: gold / n, mean: scoreSum / n };
}

function mutate(base, rng, temp) {
  const w = { ...base };
  for (const [k, scale] of Object.entries(TUNABLE)) {
    if (rng() < 0.45) {
      w[k] = w[k] + (rng() * 2 - 1) * scale * temp;
      if (k !== 'tieCatch') w[k] = Math.max(0, w[k]);
      if (k.startsWith('fodder')) w[k] = Math.min(1, w[k]);
    }
  }
  return w;
}

const rng = mulberry32(SEED * 7919 + 13);
let best = { ...DEFAULT_WEIGHTS };
let bestEval = evalWeights(best, N, SEED);
console.log(
  `base: gold=${(100 * bestEval.gold).toFixed(2)}% mean=${bestEval.mean.toFixed(1)}`
);

for (let gen = 0; gen < GENS; gen++) {
  const temp = 1 - (0.7 * gen) / GENS; // cool down over time
  let improved = false;
  for (let p = 0; p < POP; p++) {
    const cand = mutate(best, rng, temp);
    const e = evalWeights(cand, N, SEED);
    const better =
      e.gold > bestEval.gold + 0.0005 ||
      (Math.abs(e.gold - bestEval.gold) <= 0.0005 && e.mean > bestEval.mean + 0.5);
    if (better) {
      best = cand;
      bestEval = e;
      improved = true;
      console.log(
        `gen ${gen} cand ${p}: gold=${(100 * e.gold).toFixed(2)}% mean=${e.mean.toFixed(1)}`
      );
    }
  }
  if (!improved && gen % 5 === 4) {
    console.log(`gen ${gen}: no improvement`);
  }
}

console.log('\nbest weights:');
console.log(JSON.stringify(best, (k, v) => (typeof v === 'number' ? +v.toFixed(3) : v), 2));

const confirm = evalWeights(best, 30000, SEED + 1000);
console.log(
  `confirm (fresh 30k): gold=${(100 * confirm.gold).toFixed(2)}% mean=${confirm.mean.toFixed(1)}`
);

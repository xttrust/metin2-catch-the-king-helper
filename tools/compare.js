// Paired A/B solver comparison on identical boards (common random numbers).
//
//   node tools/compare.js --a heuristic --b rollout --n 2000 --seed 1
//
// Because both solvers play the same dealt boards, the difference estimate is
// far tighter than two independent benches: the paired standard error comes
// from the discordant games only (McNemar-style).

import { newGame, simMove } from '../js/engine/game.js';
import { dealBoard } from '../js/engine/belief.js';
import { mulberry32, streamSeed } from '../js/engine/rng.js';
import { GOLD_THRESHOLD } from '../js/engine/rules.js';
import { makeSolver } from '../js/solver/solver.js';

const argv = process.argv;
const optS = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : dflt;
};
const A = optS('a', 'heuristic');
const B = optS('b', 'rollout');
const N = +optS('n', 2000);
const SEED = +optS('seed', 1);

function play(policyName, truth, seed) {
  const policy = makeSolver(policyName);
  const rng = mulberry32(seed);
  const g = newGame({ trackHistory: false });
  let guard = 0;
  while (!g.over && guard++ < 300) {
    const move = policy(g, rng);
    if (!move) break;
    simMove(g, truth, move);
  }
  return g.score;
}

let goldA = 0;
let goldB = 0;
let bWinsPair = 0; // B gold, A not
let aWinsPair = 0; // A gold, B not
let sumA = 0;
let sumB = 0;
const t0 = process.hrtime.bigint();
for (let i = 0; i < N; i++) {
  const dealRng = mulberry32(streamSeed(SEED, i));
  const truth = dealBoard(dealRng);
  const sa = play(A, truth, streamSeed(SEED + 500000, i));
  const sb = play(B, truth, streamSeed(SEED + 900000, i));
  const ga = sa >= GOLD_THRESHOLD;
  const gb = sb >= GOLD_THRESHOLD;
  if (ga) goldA++;
  if (gb) goldB++;
  if (gb && !ga) bWinsPair++;
  if (ga && !gb) aWinsPair++;
  sumA += sa;
  sumB += sb;
  if ((i + 1) % 500 === 0) {
    console.log(
      `[${i + 1}/${N}] ${A}=${((100 * goldA) / (i + 1)).toFixed(1)}% ` +
        `${B}=${((100 * goldB) / (i + 1)).toFixed(1)}%`
    );
  }
}
const secs = Number(process.hrtime.bigint() - t0) / 1e9;

const diff = (goldB - goldA) / N;
// Paired SE from discordant counts.
const se = Math.sqrt(bWinsPair + aWinsPair) / N;
console.log(`\n${A}: gold=${((100 * goldA) / N).toFixed(2)}% mean=${(sumA / N).toFixed(1)}`);
console.log(`${B}: gold=${((100 * goldB) / N).toFixed(2)}% mean=${(sumB / N).toFixed(1)}`);
console.log(
  `delta (B-A): ${(100 * diff).toFixed(2)}pp +/- ${(196 * se).toFixed(2)}pp (95%), ` +
    `discordant ${bWinsPair}/${aWinsPair}`
);
console.log(`${secs.toFixed(1)}s (${(N / secs).toFixed(1)} pairs/sec)`);

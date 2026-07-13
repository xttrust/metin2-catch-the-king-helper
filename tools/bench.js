// Self-play benchmark. Node-only; not shipped to the site.
//
//   node tools/bench.js --n 20000 --seed 1 [--solver heuristic]
//
// Deals seeded boards, plays the chosen policy, and reports chest rates with
// Wilson 95% confidence intervals plus a score histogram summary.

import { newGame, simMove } from '../js/engine/game.js';
import { dealBoard } from '../js/engine/belief.js';
import { mulberry32, streamSeed } from '../js/engine/rng.js';
import { chestFor } from '../js/engine/rules.js';
import { makeSolver } from '../js/solver/solver.js';

function parseArgs(argv) {
  const args = { n: 10000, seed: 1, solver: 'heuristic' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--n') args.n = +argv[++i];
    else if (a === '--seed') args.seed = +argv[++i];
    else if (a === '--solver') args.solver = argv[++i];
    else if (a === '--quiet') args.quiet = true;
    else throw new Error(`unknown arg ${a}`);
  }
  return args;
}

export function playGame(truth, policy, rng) {
  const g = newGame({ trackHistory: false });
  let guard = 0;
  while (!g.over && guard++ < 300) {
    const move = policy(g, rng);
    if (!move) break;
    simMove(g, truth, move);
  }
  if (!g.over) throw new Error('game did not terminate');
  return g.score;
}

export function wilson(p, n, z = 1.96) {
  if (!n) return [0, 0];
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return [center - half, center + half];
}

export function runBench({ n, seed, solver }) {
  const policy = makeSolver(solver);
  const tally = { gold: 0, silver: 0, bronze: 0, none: 0 };
  let scoreSum = 0;
  const scores = new Float64Array(n);
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < n; i++) {
    const rng = mulberry32(streamSeed(seed, i));
    const truth = dealBoard(rng);
    const score = playGame(truth, policy, rng);
    tally[chestFor(score)]++;
    scoreSum += score;
    scores[i] = score;
  }
  const secs = Number(process.hrtime.bigint() - t0) / 1e9;
  scores.sort();
  return {
    n,
    seed,
    solver,
    tally,
    goldRate: tally.gold / n,
    silverRate: tally.silver / n,
    bronzeRate: tally.bronze / n,
    meanScore: scoreSum / n,
    p10: scores[(n * 0.1) | 0],
    p50: scores[(n * 0.5) | 0],
    p90: scores[(n * 0.9) | 0],
    gamesPerSec: n / secs,
    secs,
  };
}

function pct(x) {
  return `${(100 * x).toFixed(2)}%`;
}

const isMain = process.argv[1] && import.meta.url.endsWith(
  process.argv[1].split(/[\\/]/).pop()
);

if (isMain) {
  const args = parseArgs(process.argv);
  const r = runBench(args);
  const [lo, hi] = wilson(r.goldRate, r.n);
  console.log(`solver=${r.solver} n=${r.n} seed=${r.seed}`);
  console.log(
    `gold  ${pct(r.goldRate)}  [${pct(lo)}, ${pct(hi)}]  (${r.tally.gold})`
  );
  console.log(`silver ${pct(r.silverRate)}  (${r.tally.silver})`);
  console.log(`bronze ${pct(r.bronzeRate)}  (${r.tally.bronze})`);
  console.log(
    `score mean=${r.meanScore.toFixed(1)} p10=${r.p10} p50=${r.p50} p90=${r.p90}`
  );
  console.log(`${r.gamesPerSec.toFixed(0)} games/sec (${r.secs.toFixed(1)}s)`);
}

// Endgame search cost profile: from self-play positions with N hidden cells,
// how often does endgameSearch complete within budget, and how fast?
//   node tools/eg-stats.js [hidden] [budget] [positions]

import { newGame, simMove, hiddenMask } from '../js/engine/game.js';
import { dealBoard } from '../js/engine/belief.js';
import { mulberry32, streamSeed } from '../js/engine/rng.js';
import { popcount } from '../js/engine/bitboard.js';
import { heuristicPolicy } from '../js/solver/heuristic.js';
import { endgameSearch } from '../js/solver/endgame.js';

const HIDDEN = +(process.argv[2] ?? 8);
const BUDGET = +(process.argv[3] ?? 800000);
const WANT = +(process.argv[4] ?? 120);

let done = 0;
let ok = 0;
let totalMs = 0;
let worstMs = 0;
const nodes = [];
for (let i = 0; done < WANT && i < 5000; i++) {
  const rng = mulberry32(streamSeed(4242, i));
  const truth = dealBoard(rng);
  const g = newGame({ trackHistory: false });
  let guard = 0;
  while (!g.over && popcount(hiddenMask(g)) > HIDDEN && guard++ < 300) {
    const m = heuristicPolicy(g);
    if (!m) break;
    simMove(g, truth, m);
  }
  if (g.over || popcount(hiddenMask(g)) !== HIDDEN) continue;
  done++;
  const t0 = process.hrtime.bigint();
  const res = endgameSearch(g, { nodeBudget: BUDGET });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  totalMs += ms;
  worstMs = Math.max(worstMs, ms);
  if (res) {
    ok++;
    nodes.push(res.nodes);
  }
}
nodes.sort((a, b) => a - b);
console.log(
  `hidden=${HIDDEN} budget=${BUDGET}: ${ok}/${done} completed, ` +
    `avg ${(totalMs / done).toFixed(0)}ms worst ${worstMs.toFixed(0)}ms ` +
    `median-nodes ${nodes[nodes.length >> 1] ?? '-'} p90-nodes ${nodes[(nodes.length * 0.9) | 0] ?? '-'}`
);

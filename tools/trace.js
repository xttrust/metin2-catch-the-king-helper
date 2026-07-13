// Trace a single self-play game move by move (debugging aid).
//   node tools/trace.js [seed] [solver]

import { newGame, simMove } from '../js/engine/game.js';
import { dealBoard } from '../js/engine/belief.js';
import { mulberry32, streamSeed } from '../js/engine/rng.js';
import { HAND_SEQUENCE, KING, chestFor } from '../js/engine/rules.js';
import { cellName } from '../js/engine/bitboard.js';
import { makeSolver } from '../js/solver/solver.js';

const seed = +(process.argv[2] ?? 1);
const solverName = process.argv[3] ?? 'heuristic';

const rng = mulberry32(streamSeed(seed, 0));
const truth = dealBoard(rng);
const policy = makeSolver(solverName);
const g = newGame({ trackHistory: false });

const vname = (v) => (v === KING ? 'K' : String(v));

console.log('board:');
for (let r = 0; r < 5; r++) {
  console.log('  ' + [...truth.slice(r * 5, r * 5 + 5)].map(vname).join(' '));
}

let moveNo = 0;
while (!g.over && moveNo++ < 100) {
  const hand = HAND_SEQUENCE[g.handIndex];
  const move = policy(g, rng);
  if (!move) break;
  const e = simMove(g, truth, move);
  console.log(
    `#${String(moveNo).padStart(2)} hand=${vname(hand)} ${move.kind.padEnd(6)} ` +
      `${cellName(move.cell)}=${vname(e.value)}${e.flashed ? '*' : ' '} ` +
      `${e.outcome.padEnd(8)} +${e.points + e.bingoBonus} score=${g.score}`
  );
}
console.log(`final: score=${g.score} chest=${chestFor(g.score)}`);

// Parallel benchmark / paired A/B across worker threads (Node-only).
//
//   node tools/bench-par.js --solver rollout --n 100000 --seed 1
//   node tools/bench-par.js --a heuristic --b rollout --n 10000 --seed 1
//
// Same seeding scheme as bench.js/compare.js: game i is always dealt from
// streamSeed(seed, i), so results are reproducible and comparable across
// runs regardless of worker count.

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { newGame, simMove } from '../js/engine/game.js';
import { dealBoard } from '../js/engine/belief.js';
import { mulberry32, streamSeed } from '../js/engine/rng.js';
import { GOLD_THRESHOLD, SILVER_THRESHOLD, BRONZE_THRESHOLD } from '../js/engine/rules.js';
import { makeSolver } from '../js/solver/solver.js';

function play(policy, truth, seed) {
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

if (!isMainThread) {
  const { start, end, seed, a, b, optionsA, optionsB } = workerData;
  const polA = makeSolver(a, optionsA || {});
  const polB = b ? makeSolver(b, optionsB || {}) : null;
  const out = new Float64Array((end - start) * (polB ? 2 : 1));
  let k = 0;
  for (let i = start; i < end; i++) {
    const truth = dealBoard(mulberry32(streamSeed(seed, i)));
    out[k++] = play(polA, truth, streamSeed(seed + 500000, i));
    if (polB) out[k++] = play(polB, truth, streamSeed(seed + 900000, i));
    if ((i - start) % 200 === 199) parentPort.postMessage({ progress: 200 });
  }
  parentPort.postMessage({ done: out }, [out.buffer]);
} else {
  const argv = process.argv;
  const optS = (name, dflt) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : dflt;
  };
  const A = optS('a', optS('solver', 'rollout'));
  const B = optS('b', null);
  const N = +optS('n', 10000);
  const SEED = +optS('seed', 1);
  const optionsA = JSON.parse(optS('optsA', '{}'));
  const optionsB = JSON.parse(optS('optsB', '{}'));
  const W = Math.min(+optS('workers', Math.max(1, os.cpus().length - 2)), 16);

  const per = Math.ceil(N / W);
  const results = new Float64Array(N * (B ? 2 : 1));
  let doneWorkers = 0;
  let progress = 0;
  const t0 = process.hrtime.bigint();

  const finish = () => {
    const secs = Number(process.hrtime.bigint() - t0) / 1e9;
    const tier = (s) =>
      s >= GOLD_THRESHOLD ? 3 : s >= SILVER_THRESHOLD ? 2 : s >= BRONZE_THRESHOLD ? 1 : 0;
    if (!B) {
      let gold = 0;
      let silver = 0;
      let bronze = 0;
      let sum = 0;
      for (let i = 0; i < N; i++) {
        const t = tier(results[i]);
        if (t === 3) gold++;
        else if (t === 2) silver++;
        else if (t === 1) bronze++;
        sum += results[i];
      }
      const p = gold / N;
      const z = 1.96;
      const z2 = z * z;
      const denom = 1 + z2 / N;
      const center = (p + z2 / (2 * N)) / denom;
      const half = (z * Math.sqrt((p * (1 - p)) / N + z2 / (4 * N * N))) / denom;
      console.log(`solver=${A} n=${N} seed=${SEED} workers=${W}`);
      console.log(
        `gold  ${(100 * p).toFixed(2)}%  [${(100 * (center - half)).toFixed(2)}%, ${(100 * (center + half)).toFixed(2)}%]`
      );
      console.log(`silver ${((100 * silver) / N).toFixed(2)}%  bronze ${((100 * bronze) / N).toFixed(2)}%`);
      console.log(`mean score ${(sum / N).toFixed(1)}`);
    } else {
      let goldA = 0;
      let goldB = 0;
      let bOnly = 0;
      let aOnly = 0;
      let sumA = 0;
      let sumB = 0;
      for (let i = 0; i < N; i++) {
        const sa = results[2 * i];
        const sb = results[2 * i + 1];
        const ga = sa >= GOLD_THRESHOLD;
        const gb = sb >= GOLD_THRESHOLD;
        if (ga) goldA++;
        if (gb) goldB++;
        if (gb && !ga) bOnly++;
        if (ga && !gb) aOnly++;
        sumA += sa;
        sumB += sb;
      }
      const se = Math.sqrt(bOnly + aOnly) / N;
      console.log(`paired n=${N} seed=${SEED} workers=${W}`);
      console.log(`${A}: gold=${((100 * goldA) / N).toFixed(2)}% mean=${(sumA / N).toFixed(1)}`);
      console.log(`${B}: gold=${((100 * goldB) / N).toFixed(2)}% mean=${(sumB / N).toFixed(1)}`);
      console.log(
        `delta (B-A): ${((100 * (goldB - goldA)) / N).toFixed(2)}pp +/- ${(196 * se).toFixed(2)}pp (95%), discordant ${bOnly}/${aOnly}`
      );
    }
    console.log(`${secs.toFixed(1)}s (${(N / secs).toFixed(1)} games/sec)`);
  };

  for (let w = 0; w < W; w++) {
    const start = w * per;
    const end = Math.min(N, start + per);
    if (start >= end) {
      doneWorkers++;
      continue;
    }
    const worker = new Worker(fileURLToPath(import.meta.url), {
      workerData: { start, end, seed: SEED, a: A, b: B, optionsA, optionsB },
    });
    worker.on('message', (msg) => {
      if (msg.progress) {
        progress += msg.progress;
        if (progress % 2000 === 0) {
          process.stdout.write(`\r${progress}/${N}      `);
        }
        return;
      }
      const arr = new Float64Array(msg.done);
      results.set(arr, start * (B ? 2 : 1));
      if (++doneWorkers === W) {
        process.stdout.write('\r');
        finish();
      }
    });
    worker.on('error', (e) => {
      console.error(e);
      process.exit(1);
    });
  }
}

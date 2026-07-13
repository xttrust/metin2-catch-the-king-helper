// Solver registry and orchestration. Policies take (state, rng) and return
// {kind: 'reveal'|'catch', cell} or null when no move exists.

import { heuristicPolicy, DEFAULT_WEIGHTS } from './heuristic.js';
import { makeRolloutPolicy } from './rollout.js';

export function makeSolver(name, options = {}) {
  switch (name) {
    case 'heuristic': {
      const weights = { ...DEFAULT_WEIGHTS, ...(options.weights || {}) };
      return (state) => heuristicPolicy(state, weights);
    }
    case 'rollout':
      return makeRolloutPolicy(options);
    case 'max':
      // Benchmark-strength configuration (slower than live play needs).
      return makeRolloutPolicy({ samples: 320, topK: 10, endgameHidden: 8, ...options });
    default:
      throw new Error(`unknown solver "${name}"`);
  }
}

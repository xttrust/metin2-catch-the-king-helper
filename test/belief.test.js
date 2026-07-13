import { test } from 'node:test';
import assert from 'node:assert/strict';

import { KING, BOARD_COUNTS, HAND_SEQUENCE } from '../js/engine/rules.js';
import { NEIGHBOR_MASKS, bits, popcount } from '../js/engine/bitboard.js';
import {
  newGame,
  reveal,
  hiddenMask,
  catchableMask,
  simReveal,
  simCatch,
} from '../js/engine/game.js';
import {
  enumerate5Placements,
  fiveProbabilities,
  valueDistribution,
  sampleBoard,
  dealBoard,
  validate,
} from '../js/engine/belief.js';
import { mulberry32 } from '../js/engine/rng.js';

test('fresh game: uniform 5-probability of 3/25', () => {
  const g = newGame();
  const placements = enumerate5Placements(g);
  assert.equal(placements.length, 2300); // C(25,3)
  const p = fiveProbabilities(g, placements);
  for (let i = 0; i < 25; i++) {
    assert.ok(Math.abs(p[i] - 3 / 25) < 1e-12);
  }
});

test('no-flash reveal excludes all hidden neighbors from being 5', () => {
  const g = newGame();
  reveal(g, 12, 1, false); // center: 8 neighbors excluded
  const p = fiveProbabilities(g);
  for (const n of bits(NEIGHBOR_MASKS[12])) assert.equal(p[n], 0);
  assert.equal(p[12], 0); // revealed non-5
  // 24 hidden, 8 excluded -> 16 candidates, uniform 3/16
  for (let i = 0; i < 25; i++) {
    if (i === 12 || NEIGHBOR_MASKS[12] & (1 << i)) continue;
    assert.ok(Math.abs(p[i] - 3 / 16) < 1e-12);
  }
});

test('flash reveal concentrates probability on the neighbors', () => {
  const g = newGame();
  reveal(g, 0, 1, true); // corner flash: >=1 of {1,5,6} is a 5
  const p = fiveProbabilities(g);
  const inMask = p[1] + p[5] + p[6];
  assert.ok(p[1] > 3 / 25);
  assert.ok(inMask >= 1 - 1e-12); // expected number of 5s among them >= 1
  const placements = enumerate5Placements(g);
  for (const pl of placements) {
    assert.notEqual(pl & (NEIGHBOR_MASKS[0] & ~1), 0);
  }
});

test('constraint discharged by a later revealed 5', () => {
  const g = newGame();
  reveal(g, 0, 1, true); // flash at corner
  reveal(g, 1, 5, false); // neighbor turns out to be a 5 (hand 1 loses)
  const placements = enumerate5Placements(g);
  // Constraint explained: remaining two 5s are unconstrained among candidates.
  // Candidates: hidden cells (23) minus notFive exclusions from... cell 1's
  // no-flash reveal excludes ITS hidden neighbors. Just assert consistency:
  assert.ok(placements.length > 0);
  const p = fiveProbabilities(g, placements);
  // No cell forced: probability mass spread beyond the original flash mask.
  let outside = 0;
  for (let i = 0; i < 25; i++) {
    if (i !== 5 && i !== 6) outside += p[i];
  }
  assert.ok(outside > 0.5);
});

test('event-time constraints beat state-time reconstruction', () => {
  // Reveal a 5 first; then a flash on an adjacent cell must imply ANOTHER
  // hidden 5 nearby, because the already-revealed 5 cannot flash.
  const g = newGame();
  reveal(g, 6, 5, true); // face-up 5 that itself flashed (another 5 nearby)
  reveal(g, 0, 1, true); // flash: a face-down 5 among {1,5} (6 is face-up)
  const placements = enumerate5Placements(g);
  assert.ok(placements.length > 0);
  for (const pl of placements) {
    // Every valid placement puts a 5 on cell 1 or 5.
    assert.notEqual(pl & 0b100010, 0);
  }
  const p = fiveProbabilities(g, placements);
  assert.ok(p[1] + p[5] >= 1 - 1e-12);
});

test('value distribution is a proper posterior', () => {
  const g = newGame();
  reveal(g, 12, 3, false);
  reveal(g, 0, 2, true);
  const dist = valueDistribution(g);
  const hidden = hiddenMask(g);
  // Rows sum to 1 for hidden cells.
  for (let cell = 0; cell < 25; cell++) {
    if (!(hidden & (1 << cell))) continue;
    let s = 0;
    for (let v = 1; v <= KING; v++) s += dist[cell * 7 + v];
    assert.ok(Math.abs(s - 1) < 1e-9, `cell ${cell} sums to ${s}`);
  }
  // Column sums equal remaining counts.
  for (let v = 1; v <= KING; v++) {
    let s = 0;
    for (let cell = 0; cell < 25; cell++) s += dist[cell * 7 + v];
    assert.ok(Math.abs(s - g.remaining[v]) < 1e-9, `value ${v}`);
  }
});

test('sampleBoard produces exact posterior samples', () => {
  const g = newGame();
  reveal(g, 12, 1, false);
  reveal(g, 0, 1, true);
  const placements = enumerate5Placements(g);
  const rng = mulberry32(42);
  const counts = new Float64Array(25);
  const N = 20000;
  for (let s = 0; s < N; s++) {
    const truth = sampleBoard(g, rng, placements);
    // Multiset check: full board always matches BOARD_COUNTS.
    const tally = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 25; i++) tally[truth[i]]++;
    assert.deepEqual(tally.slice(1), BOARD_COUNTS.slice(1));
    // Revealed cells keep their observed values.
    assert.equal(truth[12], 1);
    assert.equal(truth[0], 1);
    for (let i = 0; i < 25; i++) {
      if (truth[i] === 5 && hiddenMask(g) & (1 << i)) counts[i]++;
    }
  }
  const p = fiveProbabilities(g, placements);
  for (let i = 0; i < 25; i++) {
    assert.ok(
      Math.abs(counts[i] / N - p[i]) < 0.015,
      `cell ${i}: empirical ${counts[i] / N} vs exact ${p[i]}`
    );
  }
});

test('validate flags contradictory observations', () => {
  const g = newGame();
  assert.equal(validate(g).ok, true);
  // Claim a flash whose entire neighborhood is later proven non-5 by
  // no-flash reveals: contradiction.
  reveal(g, 0, 1, true); // flash: 5 among {1,5,6}
  reveal(g, 2, 1, false); // excludes {1,3,6,7,8} minus revealed
  reveal(g, 10, 1, false); // excludes {5,6,11,15,16}
  // Now {1,5,6} all excluded -> no valid placement.
  assert.equal(validate(g).ok, false);
  assert.equal(enumerate5Placements(g).length, 0);
});

test('dealBoard deals the exact multiset', () => {
  const rng = mulberry32(7);
  for (let i = 0; i < 50; i++) {
    const b = dealBoard(rng);
    const tally = [0, 0, 0, 0, 0, 0, 0];
    for (let c = 0; c < 25; c++) tally[b[c]]++;
    assert.deepEqual(tally.slice(1), BOARD_COUNTS.slice(1));
  }
});

// The most important test in the suite: across thousands of random games the
// belief must never exclude the true board. Any unsound deduction rule fails
// here fast.
test('fuzz: deduction is sound across random self-play', () => {
  const rng = mulberry32(1234);
  for (let game = 0; game < 400; game++) {
    const truth = dealBoard(rng);
    const g = newGame({ trackHistory: false });
    let guard = 0;
    while (!g.over && guard++ < 200) {
      const hidden = bits(hiddenMask(g));
      const catchable = bits(catchableMask(g));
      let move;
      if (catchable.length && (!hidden.length || rng() < 0.25)) {
        move = { kind: 'catch', cell: catchable[(rng() * catchable.length) | 0] };
      } else if (hidden.length) {
        move = { kind: 'reveal', cell: hidden[(rng() * hidden.length) | 0] };
      } else {
        break;
      }
      if (move.kind === 'catch') simCatch(g, truth, move.cell);
      else simReveal(g, truth, move.cell);

      // Soundness: the true placement of still-hidden 5s must be enumerated.
      let true5s = 0;
      for (let i = 0; i < 25; i++) {
        if (truth[i] === 5 && hiddenMask(g) & (1 << i)) true5s |= 1 << i;
      }
      const placements = enumerate5Placements(g);
      assert.ok(placements.length > 0, 'belief became empty');
      assert.ok(
        placements.includes(true5s),
        `true placement excluded (game ${game})`
      );
      assert.equal(popcount(true5s), g.remaining[5]);
      assert.equal(validate(g).ok, true);

      // Score invariant: recomputable from scored cells + bingos.
      let expected = popcount(g.bingos) * 10;
      for (let i = 0; i < 25; i++) {
        if (g.scored & (1 << i)) {
          expected += g.values[i] === KING ? 100 : g.values[i] * 10;
        }
      }
      assert.equal(g.score, expected);
    }
    assert.ok(g.over, 'game must terminate');
    assert.ok(g.handIndex <= HAND_SEQUENCE.length);
  }
});

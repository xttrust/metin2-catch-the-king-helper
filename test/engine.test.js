import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BOARD_COUNTS,
  HAND_SEQUENCE,
  KING,
  POINTS,
  chestFor,
  totalBoardCards,
} from '../js/engine/rules.js';
import {
  NEIGHBOR_MASKS,
  LINE_MASKS,
  LINE_COUNT,
  CELL_LINES,
  popcount,
  bits,
  cellName,
  cellAt,
} from '../js/engine/bitboard.js';
import {
  newGame,
  reveal,
  catchAt,
  undo,
  redo,
  currentHand,
  hiddenMask,
  catchableMask,
  cloneState,
} from '../js/engine/game.js';

test('rule constants are coherent', () => {
  assert.equal(totalBoardCards(), 25);
  assert.equal(HAND_SEQUENCE.length, 12);
  assert.deepEqual(HAND_SEQUENCE, [1, 1, 1, 1, 1, 2, 2, 3, 3, 4, 5, KING]);
  assert.equal(POINTS[KING], 100);
  assert.equal(chestFor(550), 'gold');
  assert.equal(chestFor(549), 'silver');
  assert.equal(chestFor(400), 'silver');
  assert.equal(chestFor(399), 'bronze');
  assert.equal(chestFor(99), 'none');
});

test('bitboard geometry', () => {
  assert.equal(popcount(NEIGHBOR_MASKS[0]), 3); // corner
  assert.equal(popcount(NEIGHBOR_MASKS[2]), 5); // edge
  assert.equal(popcount(NEIGHBOR_MASKS[12]), 8); // center
  assert.equal(LINE_COUNT, 12);
  for (const m of LINE_MASKS) assert.equal(popcount(m), 5);
  // center sits on a row, a column, and both diagonals
  assert.equal(popcount(CELL_LINES[12]), 4);
  assert.equal(cellName(0), 'R1C1');
  assert.equal(cellName(24), 'R5C5');
  assert.deepEqual(bits(0b1011), [0, 1, 3]);
});

test('reveal outcomes: equal scores and ends turn, lower loses', () => {
  const g = newGame();
  assert.equal(currentHand(g), 1);
  const e1 = reveal(g, 0, 1, false); // hand 1 vs 1 -> score
  assert.equal(e1.outcome, 'score');
  assert.equal(g.score, 10);
  assert.equal(g.handIndex, 1);
  const e2 = reveal(g, 4, 3, false); // hand 1 vs 3 -> lose
  assert.equal(e2.outcome, 'lose');
  assert.equal(g.score, 10);
  assert.equal(g.handIndex, 2);
  assert.equal(catchableMask(g), 1 << 4);
});

test('chains continue the turn and accumulate points', () => {
  const g = newGame();
  g.handIndex = 9; // hand card 4
  const e1 = reveal(g, 0, 2, false);
  assert.equal(e1.outcome, 'chain');
  assert.equal(g.handIndex, 9);
  const e2 = reveal(g, 4, 3, false);
  assert.equal(e2.outcome, 'chain');
  const e3 = reveal(g, 24, 4, false); // equal -> turn ends
  assert.equal(e3.outcome, 'score');
  assert.equal(g.score, 20 + 30 + 40);
  assert.equal(g.handIndex, 10);
});

test('hand-5 capture: flash captures before comparison', () => {
  const g = newGame();
  g.handIndex = 10; // hand card 5
  const e = reveal(g, 12, 1, true); // flashed -> captured despite 5 > 1
  assert.equal(e.outcome, 'captured');
  assert.equal(e.points, 0);
  assert.equal(g.score, 0);
  assert.equal(g.handIndex, 11);
  assert.equal(catchableMask(g), 1 << 12); // still catchable later
});

test('hand-5 capture by revealed 5 neighbor honors the rule flag', () => {
  for (const flag of [true, false]) {
    const g = newGame({ flags: { captureOnRevealed5Neighbor: flag } });
    reveal(g, 6, 5, false); // hand 1 vs 5 -> lose, but 5 now face-up
    g.handIndex = 10; // hand card 5
    const e = reveal(g, 0, 1, false); // adjacent to revealed 5 at cell 6
    if (flag) {
      assert.equal(e.outcome, 'captured');
      assert.equal(g.score, 0);
    } else {
      assert.equal(e.outcome, 'chain');
      assert.equal(g.score, 10);
    }
  }
});

test('king turn: catching the revealed King scores 100', () => {
  const g = newGame();
  reveal(g, 12, KING, false); // hand 1 vs K -> lose
  assert.equal(g.score, 0);
  g.handIndex = 11; // hand card K
  const e = catchAt(g, 12);
  assert.equal(e.outcome, 'score');
  assert.equal(g.score, 100);
  assert.equal(g.over, true); // last hand card used
});

test('bingo requires scored cells, not just revealed ones', () => {
  const g = newGame();
  g.handIndex = 9; // hand 4 chains over 1s and 2s
  // Score four cells of row 1 (cells 0..4) with values below 4.
  reveal(g, 0, 1, false);
  reveal(g, 1, 1, false);
  reveal(g, 2, 2, false);
  reveal(g, 3, 1, false);
  // Fifth cell revealed but LOST (5 > 4): row fully revealed, not scored.
  const lose = reveal(g, 4, 5, false);
  assert.equal(lose.outcome, 'lose');
  assert.equal(g.bingos, 0);
  assert.equal(g.score, 10 + 10 + 20 + 10);
  // The 5-turn catches the revealed 5 (provably safe: the no-flash reveal of
  // cell 4 cleared its hidden neighbors): bingo completes.
  assert.equal(g.handIndex, 10);
  const e = catchAt(g, 4);
  assert.equal(e.outcome, 'score'); // 5 == 5
  assert.equal(e.bingoBonus, 10);
  assert.equal(g.bingos, 1); // line 0 = row 1
  assert.equal(g.score, 50 + 50 + 10); // four chained cells + caught 5 + bingo
});

test('undo and redo round-trip exactly', () => {
  const g = newGame();
  reveal(g, 0, 1, false); // score, hand -> 1
  reveal(g, 12, 2, true); // lose, hand -> 2
  catchAt(g, 12); // hand 1 vs 2 -> lose again
  const after = JSON.stringify({
    r: g.revealed, s: g.scored, f: g.flashMask, v: [...g.values],
    h: g.handIndex, sc: g.score, b: g.bingos, o: g.over,
    nf: g.notFive, c: g.constraints,
  });
  undo(g); undo(g); undo(g);
  assert.equal(g.revealed, 0);
  assert.equal(g.score, 0);
  assert.equal(g.handIndex, 0);
  assert.equal(g.constraints.length, 0);
  redo(g); redo(g); redo(g);
  const replay = JSON.stringify({
    r: g.revealed, s: g.scored, f: g.flashMask, v: [...g.values],
    h: g.handIndex, sc: g.score, b: g.bingos, o: g.over,
    nf: g.notFive, c: g.constraints,
  });
  assert.equal(replay, after);
});

test('input validation rejects impossible entries', () => {
  const g = newGame();
  reveal(g, 0, 1, false);
  assert.throws(() => reveal(g, 0, 2, false), /already revealed/);
  assert.throws(() => reveal(g, 1, 7, false), /bad value/);
  const g2 = newGame();
  reveal(g2, 0, KING, false);
  assert.throws(() => reveal(g2, 1, KING, false), /no K cards/);
  // Flash with every neighbor already revealed is impossible.
  const g3 = newGame();
  reveal(g3, 1, 1, false);
  reveal(g3, 5, 1, false);
  reveal(g3, 6, 1, false);
  assert.throws(() => reveal(g3, 0, 1, true), /flash reported/);
});

test('game ends after the 12th hand card', () => {
  const g = newGame();
  // Lose every turn cheaply: reveal 3s/4s/5s/K against low hands.
  const losers = [
    [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], // hands 1..1 vs 3
    [5, 4], [6, 4], // hands 2,2 vs 4
    [7, 4], [8, 4], // hands 3,3 vs 4
    [9, 5], // hand 4 vs 5
  ];
  for (const [cell, v] of losers) {
    const e = reveal(g, cell, v, false);
    assert.equal(e.outcome, 'lose');
  }
  assert.equal(g.handIndex, 10); // hand 5
  reveal(g, 10, KING, false); // 5 vs K -> lose
  assert.equal(g.handIndex, 11);
  assert.equal(g.over, false);
  const e2 = catchAt(g, 10); // K == K -> score 100, hand exhausted
  assert.equal(e2.outcome, 'score');
  assert.equal(g.score, 100);
  assert.equal(g.over, true);
});

test('the King hand card never chains: it loses to non-K cards', () => {
  const g = newGame();
  g.handIndex = 11; // hand K
  const e = reveal(g, 12, 1, false);
  assert.equal(e.outcome, 'lose');
  assert.equal(e.points, 0);
  assert.equal(g.over, true); // last hand card spent
});

test('cloneState is independent of the original', () => {
  const g = newGame();
  reveal(g, 0, 1, false);
  const c = cloneState(g);
  reveal(c, 1, 2, false);
  assert.equal(g.revealed, 1);
  assert.notEqual(c.revealed, g.revealed);
  assert.equal(g.values[1], 0);
  assert.equal(c.values[1], 2);
  assert.equal(hiddenMask(g) & 1, 0);
});

// Catch the King — core rule constants.
// Values are encoded as integers 1..5; the King is 6.
// Rules verified against the official Metin2 wiki and observed game behavior.

export const GRID = 5;
export const CELLS = 25;
export const FULL_MASK = (1 << CELLS) - 1;

export const KING = 6;

// How many of each value the 25-card board contains, indexed by value.
export const BOARD_COUNTS = [0, 7, 4, 5, 5, 3, 1];

// The fixed 12-card hand, played in this order.
export const HAND_SEQUENCE = [1, 1, 1, 1, 1, 2, 2, 3, 3, 4, 5, KING];
export const HAND_SIZE = HAND_SEQUENCE.length;

// Points awarded for scoring a card, indexed by value.
export const POINTS = [0, 10, 20, 30, 40, 50, 100];

export const BINGO_BONUS = 10;

// Chest thresholds (score >= threshold).
export const GOLD_THRESHOLD = 550;
export const SILVER_THRESHOLD = 400;
export const BRONZE_THRESHOLD = 100;

// Rule edge cases that could differ from the live game; kept as flags so a
// discrepancy found during a live event is a one-line fix.
export const DEFAULT_RULE_FLAGS = {
  // A hand-5 flip is captured by an adjacent *revealed* 5 too, not only by a
  // face-down one (face-down is what the flash shows).
  captureOnRevealed5Neighbor: true,
  // The 5-capture rule also applies when catching an already-revealed cell.
  captureAppliesToCatch: true,
};

// Outcome of playing hand card `hand` against a board card `value`.
// The King hand card is special: it only catches the board King ("catch the
// king in exactly one move") and loses to every other card — it never chains.
export function compare(hand, value) {
  if (hand === KING) return value === KING ? 'score' : 'lose';
  if (value === KING) return 'lose';
  if (hand > value) return 'chain';
  if (hand === value) return 'score';
  return 'lose';
}

export function chestFor(score) {
  if (score >= GOLD_THRESHOLD) return 'gold';
  if (score >= SILVER_THRESHOLD) return 'silver';
  if (score >= BRONZE_THRESHOLD) return 'bronze';
  return 'none';
}

export function totalBoardCards() {
  let n = 0;
  for (let v = 1; v <= KING; v++) n += BOARD_COUNTS[v];
  return n;
}

// 25-bit bitboard helpers. The whole board fits in one integer, which keeps
// belief enumeration and Monte Carlo rollouts fast enough for live use.

import { GRID, CELLS } from './rules.js';

export function popcount(x) {
  x -= (x >> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
  x = (x + (x >> 4)) & 0x0f0f0f0f;
  return (x * 0x01010101) >> 24;
}

// Indices (0..24) of the set bits in `mask`.
export function bits(mask) {
  const out = [];
  while (mask) {
    const b = mask & -mask;
    out.push(31 - Math.clz32(b));
    mask ^= b;
  }
  return out;
}

export function rowOf(cell) {
  return (cell / GRID) | 0;
}

export function colOf(cell) {
  return cell % GRID;
}

export function cellAt(row, col) {
  return row * GRID + col;
}

// 8-neighborhood mask for every cell.
export const NEIGHBOR_MASKS = (() => {
  const masks = new Int32Array(CELLS);
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      let m = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr < 0 || nr >= GRID || nc < 0 || nc >= GRID) continue;
          m |= 1 << cellAt(nr, nc);
        }
      }
      masks[cellAt(r, c)] = m;
    }
  }
  return masks;
})();

// The 12 bingo lines: 5 rows, 5 columns, 2 diagonals.
export const LINE_MASKS = (() => {
  const lines = [];
  for (let r = 0; r < GRID; r++) {
    let m = 0;
    for (let c = 0; c < GRID; c++) m |= 1 << cellAt(r, c);
    lines.push(m);
  }
  for (let c = 0; c < GRID; c++) {
    let m = 0;
    for (let r = 0; r < GRID; r++) m |= 1 << cellAt(r, c);
    lines.push(m);
  }
  let d1 = 0;
  let d2 = 0;
  for (let i = 0; i < GRID; i++) {
    d1 |= 1 << cellAt(i, i);
    d2 |= 1 << cellAt(i, GRID - 1 - i);
  }
  lines.push(d1, d2);
  return lines;
})();

export const LINE_COUNT = LINE_MASKS.length;

// For each cell, a bitmask over line indices (0..11) of the lines through it.
export const CELL_LINES = (() => {
  const out = new Int32Array(CELLS);
  for (let cell = 0; cell < CELLS; cell++) {
    let m = 0;
    for (let li = 0; li < LINE_MASKS.length; li++) {
      if (LINE_MASKS[li] & (1 << cell)) m |= 1 << li;
    }
    out[cell] = m;
  }
  return out;
})();

// Human-readable cell name like "R2C4" (1-based), matching community usage.
export function cellName(cell) {
  return `R${rowOf(cell) + 1}C${colOf(cell) + 1}`;
}

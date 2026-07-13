// Board rendering: 25 card cells with flip animation, heatmap overlay,
// solver hints. Pure view — events are delegated to the controller.

import { KING } from '../engine/rules.js';
import { cellName } from '../engine/bitboard.js';

const boardEl = document.getElementById('board');
let cells = [];

export function buildBoard(onCellTap, onCellHover) {
  boardEl.innerHTML = '';
  cells = [];
  for (let i = 0; i < 25; i++) {
    const btn = document.createElement('button');
    btn.className = 'cell dealt';
    btn.dataset.cell = i;
    btn.style.animationDelay = `${(i % 5) * 40 + Math.floor(i / 5) * 30}ms`;
    btn.setAttribute('aria-label', cellName(i));
    btn.innerHTML = `
      <div class="cell-inner">
        <div class="face back"><span class="p5chip"></span></div>
        <div class="face front"><span class="val"></span><span class="flashmark"></span></div>
      </div>`;
    btn.addEventListener('click', () => onCellTap(i));
    btn.addEventListener('pointerenter', () => onCellHover(i));
    btn.addEventListener('pointerleave', () => onCellHover(-1));
    boardEl.appendChild(btn);
    cells.push(btn);
  }
  // Re-trigger the deal animation only on build.
  setTimeout(() => cells.forEach((c) => c.classList.remove('dealt')), 1200);
}

const vLabel = (v) => (v === KING ? 'K' : String(v));

export function renderBoard(state, opts = {}) {
  const { p5 = null, heat = true, hintCell = -1, hint2Cells = [] } = opts;
  for (let i = 0; i < 25; i++) {
    const el = cells[i];
    const bit = 1 << i;
    const revealed = (state.revealed & bit) !== 0;
    const scored = (state.scored & bit) !== 0;
    const flashed = (state.flashMask & bit) !== 0;
    el.classList.toggle('revealed', revealed);
    el.classList.toggle('scored', revealed && scored);
    el.classList.toggle('unscored', revealed && !scored);
    el.classList.toggle('flashed', flashed);
    el.classList.toggle('vK', state.values[i] === KING);
    el.classList.toggle('hint', i === hintCell);
    el.classList.toggle('hint2', hint2Cells.includes(i) && i !== hintCell);
    el.classList.toggle('heat', heat && !revealed);
    if (revealed) {
      el.querySelector('.val').textContent = vLabel(state.values[i]);
    } else {
      el.querySelector('.val').textContent = '';
      const chip = el.querySelector('.p5chip');
      if (p5 && heat) {
        const p = p5[i];
        el.style.setProperty('--p5', p.toFixed(3));
        chip.textContent = p <= 0.001 ? '✓' : `${Math.round(p * 100)}%`;
        chip.classList.toggle('safe', p <= 0.001);
        chip.classList.toggle('hot', p >= 0.4);
      } else {
        el.style.setProperty('--p5', '0');
        chip.textContent = '';
        chip.classList.remove('safe', 'hot');
      }
    }
  }
}

export function shakeCell(i) {
  const el = cells[i];
  if (!el) return;
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

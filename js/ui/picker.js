// Bottom-sheet input: pick the revealed value (+flash), confirm catches,
// resolve ambiguous 5-catch outcomes.

import { KING, HAND_SEQUENCE, POINTS, compare } from '../engine/rules.js';
import { cellName } from '../engine/bitboard.js';
import { t } from '../i18n/i18n.js';

const backdrop = document.getElementById('sheetBackdrop');
const sheet = document.getElementById('picker');
const title = document.getElementById('pickerTitle');
const valuesEl = document.getElementById('pickerValues');
const flashWrap = document.getElementById('flashToggleWrap');
const flashToggle = document.getElementById('flashToggle');
const cancelBtn = document.getElementById('pickerCancel');

let resolver = null;
const vLabel = (v) => (v === KING ? 'K' : String(v));

function close(result) {
  sheet.hidden = true;
  backdrop.hidden = true;
  const r = resolver;
  resolver = null;
  if (r) r(result);
}

backdrop.addEventListener('click', () => close(null));
cancelBtn.addEventListener('click', () => close(null));

// Ask the user which value the revealed cell showed (helper mode).
export function askReveal(state, cell) {
  return new Promise((resolve) => {
    resolver = resolve;
    title.textContent = t('picker.reveal', { cell: cellName(cell) });
    flashWrap.style.display = '';
    flashToggle.checked = false;
    valuesEl.innerHTML = '';
    for (let v = 1; v <= KING; v++) {
      const b = document.createElement('button');
      b.className = 'pv' + (v === KING ? ' pvK' : '');
      b.innerHTML = `${vLabel(v)}<span class="pvc">×${state.remaining[v]}</span>`;
      b.disabled = state.remaining[v] <= 0;
      b.addEventListener('click', () => close({ value: v, flashed: flashToggle.checked }));
      valuesEl.appendChild(b);
    }
    backdrop.hidden = false;
    sheet.hidden = false;
  });
}

// Confirm a catch; when the hand-5 outcome is ambiguous, ask what happened.
export function askCatch(state, cell, ambiguous) {
  return new Promise((resolve) => {
    resolver = resolve;
    const hand = HAND_SEQUENCE[state.handIndex];
    const v = state.values[cell];
    title.textContent = t('picker.catch', { cell: cellName(cell), hand: vLabel(hand) });
    flashWrap.style.display = 'none';
    valuesEl.innerHTML = '';
    const ok = document.createElement('button');
    ok.className = 'pv';
    ok.style.aspectRatio = 'auto';
    ok.style.gridColumn = ambiguous ? 'span 3' : 'span 6';
    ok.style.padding = '12px';
    ok.style.fontSize = '1.05rem';
    ok.textContent = t('picker.catchBtn', { pts: POINTS[v] });
    ok.addEventListener('click', () => close({ captured: false }));
    valuesEl.appendChild(ok);
    if (ambiguous) {
      const cap = document.createElement('button');
      cap.className = 'pv pvDanger';
      cap.style.aspectRatio = 'auto';
      cap.style.gridColumn = 'span 3';
      cap.style.padding = '12px';
      cap.style.fontSize = '1.05rem';
      cap.textContent = t('picker.captured');
      cap.addEventListener('click', () => close({ captured: true }));
      valuesEl.appendChild(cap);
    }
    backdrop.hidden = false;
    sheet.hidden = false;
  });
}

export function pickerOpen() {
  return !sheet.hidden;
}

export function closePicker() {
  if (!sheet.hidden) close(null);
}

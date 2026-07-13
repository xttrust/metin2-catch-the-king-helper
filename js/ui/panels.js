// Side panels: current hand card, hand track, score gauge, gold chance,
// remaining counts, top-move list, suggestion bar.

import { HAND_SEQUENCE, KING, GOLD_THRESHOLD, SILVER_THRESHOLD, POINTS, chestFor } from '../engine/rules.js';
import { cellName } from '../engine/bitboard.js';
import { t } from '../i18n/i18n.js';

const vLabel = (v) => (v === KING ? 'K' : String(v));

const handBig = document.getElementById('handBig');
const handTrack = document.getElementById('handTrack');
const scoreVal = document.getElementById('scoreVal');
const scoreTarget = document.getElementById('scoreTarget');
const goldChance = document.getElementById('goldChance');
const remainingGrid = document.getElementById('remainingGrid');
const gauge = document.getElementById('chestGauge');
const topMoves = document.getElementById('topMoves');
const suggestText = document.getElementById('suggestText');

let lastHandIdx = null;

export function renderHand(state) {
  const idx = state.over ? -2 : state.handIndex;
  if (lastHandIdx !== null && idx !== lastHandIdx && !state.over) {
    handBig.classList.remove('bump');
    void handBig.offsetWidth;
    handBig.classList.add('bump');
  }
  lastHandIdx = idx;
  handBig.textContent = state.over ? '—' : vLabel(HAND_SEQUENCE[state.handIndex]);
  handTrack.innerHTML = '';
  HAND_SEQUENCE.forEach((v, i) => {
    const d = document.createElement('div');
    d.className = 'hand-mini' + (i < state.handIndex ? ' spent' : i === state.handIndex && !state.over ? ' now' : '');
    d.textContent = vLabel(v);
    handTrack.appendChild(d);
  });
}

// Arc gauge: 0..870 sweep with tier notches at 400/550.
const GAUGE_MAX = 870;
function arcPath(cx, cy, r, a0, a1) {
  const p = (a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

let lastScore = null;

export function renderScore(state) {
  if (lastScore !== null && state.score > lastScore) {
    scoreVal.classList.remove('pop');
    void scoreVal.offsetWidth;
    scoreVal.classList.add('pop');
  }
  lastScore = state.score;
  scoreVal.textContent = state.score;
  scoreVal.classList.toggle('gold', state.score >= GOLD_THRESHOLD);
  scoreTarget.textContent = `/ ${GOLD_THRESHOLD}`;
  const A0 = Math.PI * 0.75;
  const A1 = Math.PI * 2.25;
  const angle = (s) => A0 + (Math.min(s, GAUGE_MAX) / GAUGE_MAX) * (A1 - A0);
  const notch = (s, color) => {
    const a = angle(s);
    const x0 = 60 + 46 * Math.cos(a);
    const y0 = 60 + 46 * Math.sin(a);
    const x1 = 60 + 56 * Math.cos(a);
    const y1 = 60 + 56 * Math.sin(a);
    return `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${color}" stroke-width="2"/>`;
  };
  const prog = state.score > 0 ? arcPath(60, 60, 51, A0, angle(state.score)) : '';
  const tier = chestFor(state.score);
  const tierColor = tier === 'gold' ? '#f4cf7a' : tier === 'silver' ? '#b9bfc9' : tier === 'bronze' ? '#b0713c' : '#4a3722';
  gauge.innerHTML = `
    <path d="${arcPath(60, 60, 51, A0, A1)}" fill="none" stroke="#3a2c1e" stroke-width="7" stroke-linecap="round"/>
    ${prog ? `<path d="${prog}" fill="none" stroke="${tierColor}" stroke-width="7" stroke-linecap="round" style="filter:drop-shadow(0 0 5px ${tierColor})"/>` : ''}
    ${notch(SILVER_THRESHOLD, '#b9bfc9')}
    ${notch(GOLD_THRESHOLD, '#f4cf7a')}
  `;
}

export function renderGoldChance(p, exact = false) {
  const locked = p !== null && p !== undefined && p >= 0.9995;
  goldChance.closest('.goldchance')?.classList.toggle('locked', locked);
  if (p === null || p === undefined) {
    goldChance.textContent = '—';
  } else {
    goldChance.textContent = locked ? '100%' : `${(100 * p).toFixed(exact ? 1 : 0)}%`;
  }
}

export function renderRemaining(state) {
  remainingGrid.innerHTML = '';
  for (let v = 1; v <= KING; v++) {
    const total = [0, 7, 4, 5, 5, 3, 1][v];
    const d = document.createElement('div');
    d.className = 'rem-item' + (state.remaining[v] === 0 ? ' out' : '');
    d.innerHTML = `<div class="v">${vLabel(v)}</div><div class="c">${state.remaining[v]}/${total}</div>`;
    remainingGrid.appendChild(d);
  }
}

export function moveLabel(move) {
  return move.kind === 'catch'
    ? t('suggest.catch', { cell: cellName(move.cell) })
    : t('suggest.reveal', { cell: cellName(move.cell) });
}

export function renderSuggestion(state, suggestion) {
  if (state.over) {
    const chest = t(`chest.${chestFor(state.score)}`);
    suggestText.innerHTML = `<b>${t('suggest.gameOver', { score: state.score, chest })}</b>`;
    return;
  }
  if (!suggestion) {
    suggestText.textContent = t('suggest.thinking');
    return;
  }
  const label = moveLabel(suggestion);
  const why = (suggestion.reasons || []).map((r) => t(r)).join(' · ');
  suggestText.innerHTML = `<b>${label}</b>${why ? `<span class="why">${why}</span>` : ''}`;
}

export function renderInvalid() {
  suggestText.innerHTML = `<b style="color:var(--red-hi)">${t('suggest.invalid')}</b>`;
}

export function renderTopMoves(list, onPick) {
  topMoves.innerHTML = '';
  (list || []).forEach((m, i) => {
    const li = document.createElement('li');
    if (i === 0) li.classList.add('best');
    const p = m.pGold !== undefined ? `${(100 * m.pGold).toFixed(1)}%` : '';
    const why = (m.reasons || []).map((r) => t(r)).join(' · ');
    li.innerHTML = `
      <div class="tm-line"><span class="tm-move">${moveLabel(m)}</span><span class="tm-p">${p}</span></div>
      ${why ? `<div class="tm-why">${why}</div>` : ''}
      ${m.pGold !== undefined ? `<div class="tm-bar"><i style="width:${(100 * m.pGold).toFixed(1)}%"></i></div>` : ''}`;
    li.addEventListener('click', () => onPick(m));
    topMoves.appendChild(li);
  });
}

export function renderKeys() {
  const el = document.getElementById('keysHelp');
  el.innerHTML = `
    <li>${t('keys.select')}</li>
    <li><kbd>1</kbd>–<kbd>5</kbd> <kbd>K</kbd> ${t('keys.hover')}</li>
    <li><kbd>Shift</kbd>+${t('keys.shift')}</li>
    <li>${t('keys.click')}</li>
    <li><kbd>Backspace</kbd> ${t('keys.undo')}</li>
    <li><kbd>Esc</kbd> ${t('keys.new')}</li>`;
}

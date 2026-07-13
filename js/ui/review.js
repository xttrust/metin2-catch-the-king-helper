// Post-game blunder review: each recorded decision is re-evaluated by the
// solver worker; moves get chess-style grades and a gold-chance timeline.

import { t } from '../i18n/i18n.js';
import { cellName } from '../engine/bitboard.js';
import { lastGame } from '../stats/store.js';
import { chestFor } from '../engine/rules.js';

let workerRef = null;
let steps = [];
let expected = 0;
let running = false;

export function initReview(worker) {
  workerRef = worker;
  window.addEventListener('ctk-review', (e) => {
    const msg = e.detail;
    if (msg.type === 'reviewStep') {
      steps[msg.index] = msg;
      renderProgress(msg.index + 1, msg.total);
      renderSteps();
    } else if (msg.type === 'reviewDone') {
      running = false;
      renderProgress(-1);
      renderSteps(true);
    }
  });
}

function gradeOf(step) {
  if (!step) return null;
  const same = step.chosen.kind === step.best.kind && step.chosen.cell === step.best.cell;
  const delta = step.best.pGold - step.chosen.pGold;
  if (same || delta <= 0.005) return 'best';
  if (delta <= 0.04) return 'good';
  if (delta <= 0.12) return 'inaccuracy';
  return 'blunder';
}

function moveText(m) {
  return m.kind === 'catch'
    ? t('review.moveCatch', { cell: cellName(m.cell) })
    : t('review.moveReveal', { cell: cellName(m.cell) });
}

function renderProgress(i, n) {
  const el = document.getElementById('reviewProgress');
  if (!el) return;
  el.textContent = i >= 0 ? t('review.progress', { i, n }) : '';
}

function chartSvg() {
  const pts = steps.filter(Boolean).map((s, idx) => ({ x: idx, p: s.chosen.pGold }));
  if (pts.length < 2) return '';
  const W = 800;
  const H = 180;
  const px = (i) => 30 + (i / Math.max(1, pts.length - 1)) * (W - 50);
  const py = (p) => H - 24 - p * (H - 44);
  const line = pts.map((pt, i) => `${i ? 'L' : 'M'} ${px(i).toFixed(1)} ${py(pt.p).toFixed(1)}`).join(' ');
  const area = `${line} L ${px(pts.length - 1).toFixed(1)} ${H - 24} L ${px(0).toFixed(1)} ${H - 24} Z`;
  return `
  <div class="rv-chart">
    <div class="label">${t('review.chartTitle')}</div>
    <svg viewBox="0 0 ${W} ${H}" role="img">
      <line x1="30" y1="${py(0)}" x2="${W - 20}" y2="${py(0)}" stroke="#3a2c1e"/>
      <line x1="30" y1="${py(0.5)}" x2="${W - 20}" y2="${py(0.5)}" stroke="#3a2c1e" stroke-dasharray="4 5"/>
      <text x="6" y="${py(0.5) + 4}" fill="#a8987c" font-size="11">50%</text>
      <text x="6" y="${py(0) + 4}" fill="#a8987c" font-size="11">0%</text>
      <path d="${area}" fill="rgba(217,169,68,.12)"/>
      <path d="${line}" fill="none" stroke="#d9a944" stroke-width="2.5" stroke-linejoin="round"/>
      ${pts
        .map((pt, i) => {
          const g = gradeOf(steps[i]);
          const color = g === 'blunder' ? '#ec6a50' : g === 'inaccuracy' ? '#e0a877' : '#f4cf7a';
          return `<circle cx="${px(i).toFixed(1)}" cy="${py(pt.p).toFixed(1)}" r="3.4" fill="${color}"/>`;
        })
        .join('')}
    </svg>
  </div>`;
}

function renderSteps(done = false) {
  const el = document.getElementById('reviewSteps');
  if (!el) return;
  const game = lastGame();
  const counts = { best: 0, good: 0, inaccuracy: 0, blunder: 0 };
  const rows = steps
    .map((s, i) => {
      if (!s) return '';
      const g = gradeOf(s);
      counts[g]++;
      const differ = g !== 'best';
      return `
      <div class="rv-move">
        <span class="idx">${i + 1}</span>
        <span class="mv">${moveText(s.chosen)}</span>
        <span class="grade ${g}">${t(`grade.${g}`)}</span>
        <span class="delta">${(100 * s.chosen.pGold).toFixed(1)}%</span>
        ${differ ? `<div class="rv-alt">${t('review.betterWas', { move: moveText(s.best), p: (100 * s.best.pGold).toFixed(1) })}</div>` : ''}
      </div>`;
    })
    .join('');
  const summary = done
    ? `<p class="muted">${t('review.summary', counts)}</p>`
    : '';
  el.innerHTML = chartSvg() + summary + `<div class="rv-moves">${rows}</div>`;
}

export function renderReviewView() {
  const pick = document.getElementById('reviewPick');
  const body = document.getElementById('reviewBody');
  const game = lastGame();
  if (!game || !game.decisions?.length) {
    pick.innerHTML = '';
    body.innerHTML = `<p class="muted">${t('review.none')}</p>`;
    return;
  }
  const when = new Date(game.ts).toLocaleString();
  pick.innerHTML = `
    <p><b>${game.score}</b> — ${t(`chest.${game.chest}`)} · ${t(`stats.mode.${game.mode}`)} · ${when}</p>
    <button class="primary" id="btnAnalyze">${t('review.analyze')}</button>
    <span class="muted" id="reviewProgress" style="margin-left:10px"></span>`;
  body.innerHTML = `<div id="reviewSteps"></div>`;
  document.getElementById('btnAnalyze').addEventListener('click', () => {
    if (running) return;
    running = true;
    const decisions = game.decisions.filter((d) => d.state);
    steps = new Array(decisions.length).fill(null);
    expected = decisions.length;
    renderProgress(0, expected);
    workerRef.postMessage({ type: 'review', decisions, reqId: -1 });
  });
}

// App controller: game state, input flows (tap + keyboard), worker client,
// mode switching (helper / practice), view routing.

import {
  newGame,
  reveal,
  catchAt,
  undo,
  redo,
  canUndo,
  canRedo,
  serializeState,
  simMove,
  hasRevealed5Neighbor,
  hiddenMask,
} from '../engine/game.js';
import { HAND_SEQUENCE, KING, chestFor, compare } from '../engine/rules.js';
import { NEIGHBOR_MASKS, cellName } from '../engine/bitboard.js';
import { dealBoard } from '../engine/belief.js';
import { mulberry32 } from '../engine/rng.js';
import { initI18n, setLang, getLang, t, applyDom, onLangChange } from '../i18n/i18n.js';
import { buildBoard, renderBoard, shakeCell } from './board.js';
import {
  renderHand,
  renderScore,
  renderGoldChance,
  renderRemaining,
  renderSuggestion,
  renderInvalid,
  renderTopMoves,
  renderKeys,
} from './panels.js';
import { askReveal, askCatch, pickerOpen, closePicker } from './picker.js';
import { recordGame, saveLastGame } from '../stats/store.js';
import { initReview, renderReviewView } from './review.js';
import { renderStatsView } from './stats-view.js';

// ---------------- app state ----------------
let mode = 'helper'; // 'helper' | 'practice'
let state = newGame();
let truth = null; // practice-mode hidden board
let decisions = [];
let recorded = false;
let hoverCell = -1;
let heatOn = true;
let coachOn = true;
let lastSuggestion = null;
let lastAnalysis = null;
let busy = false;

// ---------------- worker ----------------
const worker = new Worker(new URL('../solver/worker.js', import.meta.url), { type: 'module' });
let reqId = 0;

worker.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'analysis') {
    if (msg.reqId !== reqId) return;
    lastAnalysis = msg;
    if (msg.suggestion !== undefined) {
      lastSuggestion = msg.suggestion;
      renderSuggestion(state, lastSuggestion);
    }
    if (msg.top !== undefined) {
      renderTopMoves(msg.top, (m) => tryMoveFromSuggestion(m));
    }
    if (msg.pGold !== null && msg.pGold !== undefined) {
      renderGoldChance(msg.pGold, !!msg.exact);
    }
    paintBoard();
  } else if (msg.type === 'invalid') {
    if (msg.reqId !== reqId) return;
    renderInvalid();
  } else if (msg.type === 'reviewStep' || msg.type === 'reviewDone') {
    window.dispatchEvent(new CustomEvent('ctk-review', { detail: msg }));
  }
};

function requestAnalysis() {
  reqId += 1;
  lastSuggestion = null;
  if (!state.over) renderSuggestion(state, null);
  renderGoldChance(null);
  worker.postMessage({ type: 'analyze', state: serializeState(state), reqId });
}

// ---------------- rendering ----------------
function paintBoard() {
  const hintCell = lastSuggestion && !state.over ? lastSuggestion.cell : -1;
  const hint2 = lastAnalysis?.top ? lastAnalysis.top.slice(1, 3).map((m) => m.cell) : [];
  renderBoard(state, {
    p5: lastAnalysis?.p5 ?? null,
    heat: heatOn,
    hintCell,
    hint2Cells: hint2,
  });
}

function renderAll() {
  renderHand(state);
  renderScore(state);
  renderRemaining(state);
  renderSuggestion(state, lastSuggestion);
  paintBoard();
  document.getElementById('btnUndo').disabled = !canUndo(state);
  document.getElementById('btnRedo').disabled = !canRedo(state);
}

function renderModeBanner() {
  const el = document.getElementById('modeBanner');
  if (mode === 'practice') {
    el.innerHTML = `<span class="chip">${t('practice.chip')}</span><span>${t('practice.banner')}</span>
      <label><input type="checkbox" id="coachToggle" ${coachOn ? 'checked' : ''}/> ${t('practice.coachToggle')}</label>`;
    el.querySelector('#coachToggle').addEventListener('change', (e) => {
      coachOn = e.target.checked;
      document.getElementById('coachBox').hidden = !coachOn;
    });
    document.getElementById('coachBox').hidden = !coachOn;
  } else {
    el.innerHTML = '';
    document.getElementById('coachBox').hidden = true;
  }
}

// ---------------- game flow ----------------
function newRound() {
  state = newGame();
  decisions = [];
  recorded = false;
  lastSuggestion = null;
  lastAnalysis = null;
  truth = mode === 'practice' ? dealBoard(mulberry32((Date.now() ^ (Math.random() * 1e9)) >>> 0)) : null;
  document.getElementById('coachText').textContent = '';
  renderAll();
  requestAnalysis();
}

function afterMove() {
  if (state.over && !recorded) {
    recorded = true;
    const rec = {
      ts: Date.now(),
      mode,
      score: state.score,
      chest: chestFor(state.score),
      lang: getLang(),
    };
    recordGame(rec);
    saveLastGame({ ...rec, decisions });
  }
  renderAll();
  requestAnalysis();
}

function coachFeedback(move) {
  if (mode !== 'practice' || !coachOn) return;
  const box = document.getElementById('coachText');
  if (!lastSuggestion) {
    box.textContent = '';
    return;
  }
  const same = lastSuggestion.kind === move.kind && lastSuggestion.cell === move.cell;
  box.innerHTML = same
    ? `<span class="agree">${t('practice.agree', { cell: cellName(move.cell) })}</span>`
    : `<span class="differ">${t('practice.differ', {
        best: `${cellName(lastSuggestion.cell)}`,
        chosen: `${cellName(move.cell)}`,
      })}</span>`;
}

function logDecision(move) {
  decisions.push({ state: serializeState(state), move });
}

async function tapCell(cell) {
  if (state.over || busy || pickerOpen()) return;
  const bit = 1 << cell;
  const revealed = (state.revealed & bit) !== 0;
  const hand = HAND_SEQUENCE[state.handIndex];

  if (mode === 'practice') {
    const move = revealed ? { kind: 'catch', cell } : { kind: 'reveal', cell };
    if (revealed) {
      if (state.scored & bit) return;
      if (compare(hand, state.values[cell]) === 'lose') {
        shakeCell(cell);
        return;
      }
    }
    coachFeedback(move);
    logDecision(move);
    try {
      simMove(state, truth, move);
    } catch {
      decisions.pop();
      shakeCell(cell);
      return;
    }
    afterMove();
    return;
  }

  // helper mode
  busy = true;
  try {
    if (!revealed) {
      const ans = await askReveal(state, cell);
      if (!ans) return;
      logDecision({ kind: 'reveal', cell });
      try {
        reveal(state, cell, ans.value, ans.flashed);
      } catch {
        decisions.pop();
        shakeCell(cell);
        return;
      }
      afterMove();
    } else {
      if (state.scored & bit) return;
      if (compare(hand, state.values[cell]) === 'lose') {
        shakeCell(cell);
        return;
      }
      let ambiguous = false;
      if (hand === 5 && state.flags.captureAppliesToCatch) {
        if (state.flags.captureOnRevealed5Neighbor && hasRevealed5Neighbor(state, cell)) {
          ambiguous = false; // certain capture; engine resolves it
        } else if (NEIGHBOR_MASKS[cell] & hiddenMask(state) & ~state.notFive) {
          ambiguous = true;
        }
      }
      const ans = await askCatch(state, cell, ambiguous);
      if (!ans) return;
      logDecision({ kind: 'catch', cell });
      try {
        catchAt(state, cell, { captured: ans.captured });
      } catch {
        decisions.pop();
        shakeCell(cell);
        return;
      }
      afterMove();
    }
  } finally {
    busy = false;
  }
}

function tryMoveFromSuggestion(m) {
  // Clicking a top-move focuses its cell (no auto-play in helper mode; in
  // practice mode it plays the move).
  if (mode === 'practice') tapCell(m.cell);
  else shakeCellSoft(m.cell);
}

function shakeCellSoft(cell) {
  const el = document.querySelector(`.cell[data-cell="${cell}"]`);
  el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  el?.focus({ preventScroll: true });
}

// keyboard: hover + value key reveals (helper mode)
function onKey(e) {
  const view = currentView;
  if (view !== 'play' && view !== 'practice') return;
  if (pickerOpen()) {
    if (e.key === 'Escape') closePicker();
    return;
  }
  if (e.key === 'Backspace') {
    e.preventDefault();
    doUndo();
    return;
  }
  if (e.key === 'Escape') {
    newRound();
    return;
  }
  if (mode !== 'helper' || state.over || hoverCell < 0) return;
  const bit = 1 << hoverCell;
  if (state.revealed & bit) return;
  let value = 0;
  if (e.key >= '1' && e.key <= '5') value = +e.key;
  else if (e.key === '6' || e.key.toLowerCase() === 'k') value = KING;
  if (!value) return;
  if (state.remaining[value] <= 0) {
    shakeCell(hoverCell);
    return;
  }
  logDecision({ kind: 'reveal', cell: hoverCell });
  try {
    reveal(state, hoverCell, value, e.shiftKey);
  } catch {
    decisions.pop();
    shakeCell(hoverCell);
    return;
  }
  afterMove();
}

function doUndo() {
  if (!canUndo(state)) return;
  undo(state);
  decisions.pop();
  recorded = false;
  renderAll();
  requestAnalysis();
}

function doRedo() {
  if (!canRedo(state)) return;
  const ev = state.future[state.future.length - 1];
  decisions.push({ state: serializeState(state), move: { kind: ev.kind, cell: ev.cell } });
  redo(state);
  renderAll();
  requestAnalysis();
}

// ---------------- views ----------------
let currentView = 'play';

function showView(name) {
  currentView = name;
  const isPlay = name === 'play' || name === 'practice';
  document.getElementById('view-play').hidden = !isPlay;
  document.getElementById('view-review').hidden = name !== 'review';
  document.getElementById('view-stats').hidden = name !== 'stats';
  document.getElementById('view-help').hidden = name !== 'help';
  document.querySelectorAll('.tab').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === name);
  });
  if (isPlay) {
    const newMode = name === 'practice' ? 'practice' : 'helper';
    if (newMode !== mode) {
      mode = newMode;
      renderModeBanner();
      newRound();
    }
  } else if (name === 'review') {
    renderReviewView();
  } else if (name === 'stats') {
    renderStatsView();
  } else if (name === 'help') {
    document.getElementById('helpArticle').innerHTML = t('help.html');
  }
}

// ---------------- boot ----------------
function boot() {
  initI18n();
  renderKeys();
  buildBoard(tapCell, (c) => {
    hoverCell = c;
  });
  document.querySelectorAll('.tab').forEach((b) => {
    b.addEventListener('click', () => showView(b.dataset.view));
  });
  document.querySelectorAll('.lang-switch button').forEach((b) => {
    b.classList.toggle('active', b.dataset.lang === getLang());
    b.addEventListener('click', () => setLang(b.dataset.lang));
  });
  onLangChange(() => {
    document.querySelectorAll('.lang-switch button').forEach((b) => {
      b.classList.toggle('active', b.dataset.lang === getLang());
    });
    renderKeys();
    renderModeBanner();
    renderAll();
    if (currentView === 'help') {
      document.getElementById('helpArticle').innerHTML = t('help.html');
    }
    if (currentView === 'review') renderReviewView();
    if (currentView === 'stats') renderStatsView();
  });
  document.getElementById('btnUndo').addEventListener('click', doUndo);
  document.getElementById('btnRedo').addEventListener('click', doRedo);
  document.getElementById('btnNew').addEventListener('click', newRound);
  document.getElementById('btnHeat').addEventListener('click', (e) => {
    heatOn = !heatOn;
    e.currentTarget.classList.toggle('toggled', heatOn);
    paintBoard();
  });
  window.addEventListener('keydown', onKey);
  initReview(worker, () => reqId);
  renderModeBanner();
  renderAll();
  requestAnalysis();

  if (
    'serviceWorker' in navigator &&
    (location.protocol === 'https:' || location.hostname === 'localhost')
  ) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot();

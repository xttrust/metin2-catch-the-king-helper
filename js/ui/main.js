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
import { HAND_SEQUENCE, KING, GOLD_THRESHOLD, chestFor, compare } from '../engine/rules.js';
import { NEIGHBOR_MASKS, cellName } from '../engine/bitboard.js';
import { dealBoard } from '../engine/belief.js';
import { mulberry32 } from '../engine/rng.js';
import { initI18n, setLang, getLang, t, applyDom, onLangChange } from '../i18n/i18n.js';
import { buildBoard, renderBoard, shakeCell, setSelectedCell } from './board.js';
import {
  initFx,
  soundOn,
  setSound,
  playScore,
  playCaptured,
  playChime,
  playFanfare,
  confettiBurst,
  showBanner,
  floatText,
} from './fx.js';
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
let selectedCell = -1; // face-down cell armed for keyboard input
let heatOn = true;
let coachOn = true;
let lastSuggestion = null;
let lastAnalysis = null;
let busy = false;
let goldLockedShown = false; // "100% gold" celebrated this round
let lastPointerType = 'mouse'; // touch users get the sheet, mouse users don't

window.addEventListener(
  'pointerdown',
  (e) => {
    lastPointerType = e.pointerType || 'mouse';
  },
  true
);

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
      // The endgame search proved gold is guaranteed — celebrate once.
      if (msg.exact && msg.pGold >= 0.9995 && !state.over) celebrateGoldLocked();
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

// ---------------- selection + move feedback ----------------
// Arm a face-down cell for keyboard input (-1 clears) and show the hint line.
function selectCell(cell) {
  selectedCell = cell;
  setSelectedCell(cell);
  const hint = document.getElementById('tapHint');
  if (cell < 0) {
    hint.hidden = true;
  } else {
    hint.innerHTML = t('hint.selected', { cell: cellName(cell) });
    hint.hidden = false;
  }
}

// Floating text + sound for an applied move event.
function moveFx(ev) {
  if (!ev) return;
  if (ev.outcome === 'captured') {
    floatText(ev.cell, t('fx.captured'), 'bad');
    playCaptured();
  } else if (ev.points > 0) {
    floatText(ev.cell, `+${ev.points}`, ev.value === KING ? 'king' : '');
    playScore(ev.points);
    if (ev.bingoBonus > 0) {
      const c = ev.cell;
      const bonus = ev.bingoBonus;
      setTimeout(() => floatText(c, `${t('fx.bingo')} +${bonus}`, 'bingo'), 320);
    }
  } else if (ev.kind === 'reveal' && ev.value === KING) {
    floatText(ev.cell, '👑', 'king');
  }
}

function celebrateGoldLocked() {
  if (goldLockedShown) return;
  goldLockedShown = true;
  playChime();
  confettiBurst(false);
  showBanner(t('fx.goldLocked'), t('fx.goldLockedSub'));
}

function celebrateGoldWin() {
  goldLockedShown = true;
  playFanfare();
  confettiBurst(true);
  showBanner(t('fx.goldWin'), t('fx.goldWinSub', { score: state.score }), true);
}

// ---------------- game flow ----------------
function newRound() {
  state = newGame();
  decisions = [];
  recorded = false;
  lastSuggestion = null;
  lastAnalysis = null;
  goldLockedShown = false;
  selectCell(-1);
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
    if (rec.chest === 'gold') celebrateGoldWin();
  } else if (!state.over && state.score >= GOLD_THRESHOLD) {
    // Score already crossed the gold line with turns to spare.
    celebrateGoldLocked();
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
    let ev;
    try {
      ev = simMove(state, truth, move);
    } catch {
      decisions.pop();
      shakeCell(cell);
      return;
    }
    moveFx(ev);
    afterMove();
    return;
  }

  // helper mode — reveal: no popup on desktop, just arm the cell for the
  // value keys; touch users (no keyboard) still get the sheet.
  if (!revealed) {
    if (lastPointerType === 'touch') {
      busy = true;
      try {
        const ans = await askReveal(state, cell);
        if (!ans) return;
        logDecision({ kind: 'reveal', cell });
        let ev;
        try {
          ev = reveal(state, cell, ans.value, ans.flashed);
        } catch {
          decisions.pop();
          shakeCell(cell);
          return;
        }
        selectCell(-1);
        moveFx(ev);
        afterMove();
      } finally {
        busy = false;
      }
    } else {
      selectCell(selectedCell === cell ? -1 : cell);
    }
    return;
  }

  // helper mode — catch: instant, no confirmation. The sheet only appears
  // when the hand-5 outcome genuinely depends on info the app cannot know.
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
  let captured = false;
  if (ambiguous) {
    busy = true;
    try {
      const ans = await askCatch(state, cell, true);
      if (!ans) return;
      captured = ans.captured;
    } finally {
      busy = false;
    }
  }
  logDecision({ kind: 'catch', cell });
  let ev;
  try {
    ev = catchAt(state, cell, { captured });
  } catch {
    decisions.pop();
    shakeCell(cell);
    return;
  }
  moveFx(ev);
  afterMove();
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
    if (selectedCell >= 0) {
      selectCell(-1);
      return;
    }
    newRound();
    return;
  }
  if (mode !== 'helper' || state.over) return;
  // An explicitly selected (clicked) cell wins over the hovered one.
  const target = selectedCell >= 0 ? selectedCell : hoverCell;
  if (target < 0) return;
  const bit = 1 << target;
  if (state.revealed & bit) return;
  // Use e.code, not e.key: with Shift held (= "flashed") the key value
  // becomes '!'..'%' on most layouts while the code stays Digit1..Digit5.
  let value = 0;
  const digit = /^(?:Digit|Numpad)([1-6])$/.exec(e.code || '')?.[1];
  if (digit) value = digit === '6' ? KING : +digit;
  else if (e.key >= '1' && e.key <= '5') value = +e.key;
  else if (e.key === '6' || e.key.toLowerCase() === 'k') value = KING;
  if (!value) return;
  if (state.remaining[value] <= 0) {
    shakeCell(target);
    return;
  }
  logDecision({ kind: 'reveal', cell: target });
  let ev;
  try {
    ev = reveal(state, target, value, e.shiftKey);
  } catch {
    decisions.pop();
    shakeCell(target);
    return;
  }
  selectCell(-1);
  moveFx(ev);
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
  const btnSound = document.getElementById('btnSound');
  btnSound.classList.toggle('toggled', soundOn());
  btnSound.addEventListener('click', () => {
    setSound(!soundOn());
    btnSound.classList.toggle('toggled', soundOn());
  });
  initFx();
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

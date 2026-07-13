// Stats dashboard: aggregate tiles, score-distribution histogram (SVG),
// recent games, JSON import/export.

import { t } from '../i18n/i18n.js';
import { allGames, wipeGames, exportJson, importJson } from '../stats/store.js';
import { GOLD_THRESHOLD } from '../engine/rules.js';

function tile(cls, label, value) {
  return `<div class="stat-tile ${cls}"><div class="label">${label}</div><div class="big">${value}</div></div>`;
}

function histogram(games) {
  if (games.length < 3) return '';
  const BUCKET = 50;
  const MAX = 900;
  const buckets = new Array(MAX / BUCKET).fill(0);
  for (const g of games) {
    buckets[Math.min(buckets.length - 1, Math.floor(g.score / BUCKET))]++;
  }
  const peak = Math.max(...buckets, 1);
  const W = 800;
  const H = 190;
  const bw = (W - 60) / buckets.length;
  const bars = buckets
    .map((n, i) => {
      const h = (n / peak) * (H - 55);
      const x = 30 + i * bw;
      const from = i * BUCKET;
      const gold = from >= GOLD_THRESHOLD - BUCKET + 1 && from + BUCKET > GOLD_THRESHOLD;
      const color = from >= GOLD_THRESHOLD ? '#d9a944' : from >= 400 ? '#8d939d' : '#7a5a38';
      return `<rect x="${x.toFixed(1)}" y="${(H - 30 - h).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${color}" opacity="${from >= GOLD_THRESHOLD ? 1 : 0.75}"/>`;
    })
    .join('');
  const labels = [0, 200, 400, 550, 700]
    .map((s) => {
      const x = 30 + (s / BUCKET) * bw;
      return `<text x="${x}" y="${H - 12}" fill="#a8987c" font-size="11" text-anchor="middle">${s}</text>
              <line x1="${x}" y1="${H - 30}" x2="${x}" y2="${H - 26}" stroke="#3a2c1e"/>`;
    })
    .join('');
  return `<div class="chart-box"><div class="label">${t('stats.distTitle')}</div>
    <svg viewBox="0 0 ${W} ${H}" role="img">${bars}${labels}</svg></div>`;
}

function recent(games) {
  const rows = games
    .slice(-15)
    .reverse()
    .map((g) => {
      const d = new Date(g.ts);
      const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
        ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      return `<div class="rv-move">
        <span class="idx">${date}</span>
        <span class="mv">${g.score}</span>
        <span class="grade ${g.chest === 'gold' ? 'good' : g.chest === 'silver' ? 'best' : 'inaccuracy'}">${t(`chest.${g.chest}`)}</span>
        <span class="delta muted">${t(`stats.mode.${g.mode}`)}</span>
      </div>`;
    })
    .join('');
  return `<div class="chart-box"><div class="label">${t('stats.recentTitle')}</div><div class="rv-moves">${rows}</div></div>`;
}

export function renderStatsView() {
  const body = document.getElementById('statsBody');
  const games = allGames();
  if (!games.length) {
    body.innerHTML = `<p class="muted">${t('stats.empty')}</p>`;
  } else {
    const gold = games.filter((g) => g.chest === 'gold').length;
    const avg = games.reduce((s, g) => s + g.score, 0) / games.length;
    const best = Math.max(...games.map((g) => g.score));
    body.innerHTML = `
      <div class="stat-tiles">
        ${tile('', t('stats.games'), games.length)}
        ${tile('gold', t('stats.goldRate'), `${((100 * gold) / games.length).toFixed(1)}%`)}
        ${tile('', t('stats.avgScore'), avg.toFixed(0))}
        ${tile('', t('stats.bestScore'), best)}
      </div>
      ${histogram(games)}
      ${recent(games)}`;
  }

  const exportBtn = document.getElementById('btnExport');
  const importBtn = document.getElementById('btnImport');
  const importFile = document.getElementById('importFile');
  const wipeBtn = document.getElementById('btnWipe');
  exportBtn.onclick = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ctk-stats.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  importBtn.onclick = () => importFile.click();
  importFile.onchange = async () => {
    const file = importFile.files?.[0];
    if (!file) return;
    try {
      importJson(await file.text());
      renderStatsView();
    } catch {
      /* ignore malformed files */
    }
    importFile.value = '';
  };
  wipeBtn.onclick = () => {
    if (confirm(t('stats.wipeConfirm'))) {
      wipeGames();
      renderStatsView();
    }
  };
}

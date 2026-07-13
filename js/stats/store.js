// Local persistence: finished games, and the last game's decision log for
// the review view. Everything stays in the browser (localStorage).

const GAMES_KEY = 'ctk-stats-v1';
const LAST_KEY = 'ctk-lastgame-v1';

function load(key, dflt) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : dflt;
  } catch {
    return dflt;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: stats are best-effort */
  }
}

export function recordGame(game) {
  const data = load(GAMES_KEY, { games: [] });
  data.games.push(game);
  if (data.games.length > 2000) data.games.splice(0, data.games.length - 2000);
  save(GAMES_KEY, data);
}

export function allGames() {
  return load(GAMES_KEY, { games: [] }).games;
}

export function wipeGames() {
  localStorage.removeItem(GAMES_KEY);
}

export function exportJson() {
  return JSON.stringify({ version: 1, ...load(GAMES_KEY, { games: [] }) }, null, 1);
}

export function importJson(text) {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed.games)) throw new Error('bad file');
  const data = load(GAMES_KEY, { games: [] });
  data.games = data.games.concat(
    parsed.games.filter((g) => typeof g.score === 'number' && g.ts)
  );
  data.games.sort((a, b) => a.ts - b.ts);
  save(GAMES_KEY, data);
  return parsed.games.length;
}

// Decision log of the most recent finished game (for review).
export function saveLastGame(record) {
  save(LAST_KEY, record);
}

export function lastGame() {
  return load(LAST_KEY, null);
}

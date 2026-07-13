// Feedback & celebration FX: synthesized WebAudio sounds (no asset files),
// canvas confetti bursts, floating score text and banner overlays.

const LS_KEY = 'ctk-sound';
let enabled = localStorage.getItem(LS_KEY) !== 'off';
let actx = null;

export function soundOn() {
  return enabled;
}

export function setSound(on) {
  enabled = on;
  localStorage.setItem(LS_KEY, on ? 'on' : 'off');
}

function audio() {
  if (!enabled) return null;
  try {
    actx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    return actx;
  } catch {
    return null;
  }
}

// Browsers only allow audio after a user gesture; warm the context on the
// first one so celebration sounds later start without delay.
export function initFx() {
  const unlock = () => {
    audio();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

function tone(ac, t0, { f, d = 0.15, type = 'sine', g = 0.1, slide = 0 }) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t0 + d);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(g, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + d + 0.05);
}

// Small two-note pop on any scored card; pitch scales with the points.
export function playScore(pts) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const base = 480 + Math.min(pts, 100) * 3;
  tone(ac, t, { f: base, d: 0.1, type: 'triangle', g: 0.07 });
  tone(ac, t + 0.07, { f: base * 1.5, d: 0.14, type: 'sine', g: 0.05 });
}

// Sad descending slide when the hand-5 gets captured.
export function playCaptured() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  tone(ac, t, { f: 330, slide: 165, d: 0.3, type: 'sawtooth', g: 0.04 });
  tone(ac, t + 0.02, { f: 220, slide: 110, d: 0.35, type: 'triangle', g: 0.06 });
}

// Gold guaranteed: bright ascending arpeggio with a shimmer on top.
export function playChime() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    tone(ac, t + i * 0.09, { f, d: 0.5, type: 'sine', g: 0.09 });
    tone(ac, t + i * 0.09, { f: f * 2, d: 0.3, type: 'sine', g: 0.025 });
  });
  tone(ac, t + 0.45, { f: 2093, d: 0.8, type: 'sine', g: 0.03 });
}

// Gold chest won: short brass-ish fanfare with a sparkle tail.
export function playFanfare() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const seq = [
    [392, 0, 0.18],
    [523.25, 0.16, 0.18],
    [659.25, 0.32, 0.18],
    [783.99, 0.48, 0.42],
    [659.25, 0.94, 0.14],
    [783.99, 1.08, 0.72],
  ];
  for (const [f, dt, d] of seq) {
    tone(ac, t + dt, { f, d, type: 'sawtooth', g: 0.04 });
    tone(ac, t + dt, { f: f / 2, d, type: 'triangle', g: 0.05 });
    tone(ac, t + dt, { f: f * 2, d: d * 0.8, type: 'sine', g: 0.02 });
  }
  [1567.98, 2093, 2637.02].forEach((f, i) => {
    tone(ac, t + 1.15 + i * 0.08, { f, d: 0.5, type: 'sine', g: 0.025 });
  });
}

// Confetti burst. Small: radial pop near the board. Big: two corner cannons
// plus a center shower for the gold-chest finish.
export function confettiBurst(big = false) {
  const canvas = document.createElement('canvas');
  canvas.className = 'fx-confetti';
  document.body.appendChild(canvas);
  const g = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = (canvas.width = window.innerWidth * dpr);
  const H = (canvas.height = window.innerHeight * dpr);
  const colors = ['#f4cf7a', '#d9a944', '#c9422f', '#ece0c8', '#8a6a24', '#67c493'];
  const N = big ? 240 : 100;
  const parts = [];
  for (let i = 0; i < N; i++) {
    let x, y, a;
    if (big) {
      const side = i % 3;
      if (side === 0) {
        x = 0; y = H;
        a = -Math.PI / 3 + (Math.random() - 0.5) * 0.5;
      } else if (side === 1) {
        x = W; y = H;
        a = (-Math.PI * 2) / 3 + (Math.random() - 0.5) * 0.5;
      } else {
        x = W / 2; y = H * 0.3;
        a = Math.random() * Math.PI * 2;
      }
    } else {
      x = W / 2; y = H * 0.38;
      a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
    }
    const v = (big ? 9 : 6.5) * (0.5 + Math.random()) * dpr;
    parts.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      w: (4 + Math.random() * 5) * dpr,
      h: (6 + Math.random() * 7) * dpr,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      c: colors[i % colors.length],
      life: 1,
    });
  }
  const decay = big ? 0.006 : 0.011;
  const step = () => {
    g.clearRect(0, 0, W, H);
    let alive = false;
    for (const p of parts) {
      if (p.life <= 0) continue;
      alive = true;
      p.vy += 0.16 * dpr;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life -= decay;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.globalAlpha = Math.max(p.life, 0);
      g.fillStyle = p.c;
      g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      g.restore();
    }
    if (alive) requestAnimationFrame(step);
    else canvas.remove();
  };
  requestAnimationFrame(step);
}

// Center-screen banner that scales in, holds, and fades out.
export function showBanner(title, sub = '', big = false) {
  document.querySelectorAll('.fx-banner').forEach((b) => b.remove());
  const el = document.createElement('div');
  el.className = 'fx-banner' + (big ? ' big' : '');
  const h = document.createElement('div');
  h.className = 'fx-banner-title';
  h.textContent = title;
  el.appendChild(h);
  if (sub) {
    const s = document.createElement('div');
    s.className = 'fx-banner-sub';
    s.textContent = sub;
    el.appendChild(s);
  }
  document.body.appendChild(el);
  const hold = big ? 3200 : 2100;
  setTimeout(() => el.classList.add('out'), hold);
  setTimeout(() => el.remove(), hold + 700);
}

// Floating text (e.g. "+30", "BINGO") rising out of a board cell.
export function floatText(cell, text, cls = '') {
  const host = document.querySelector(`.cell[data-cell="${cell}"]`);
  if (!host) return;
  const f = document.createElement('div');
  f.className = `fx-float ${cls}`;
  f.textContent = text;
  host.appendChild(f);
  setTimeout(() => f.remove(), 1400);
}

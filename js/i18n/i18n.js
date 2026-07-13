// Tiny i18n: dictionaries per language, t() lookup with {param} interpolation,
// DOM binding via [data-i18n], persisted choice, navigator detection.

import { en } from './en.js';
import { de } from './de.js';
import { ro } from './ro.js';

const DICTS = { en, de, ro };
const LS_KEY = 'ctk-lang';
let current = 'en';
const listeners = [];

export function detectLang() {
  const saved = localStorage.getItem(LS_KEY);
  if (saved && DICTS[saved]) return saved;
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return DICTS[nav] ? nav : 'en';
}

export function getLang() {
  return current;
}

export function setLang(lang) {
  if (!DICTS[lang]) return;
  current = lang;
  localStorage.setItem(LS_KEY, lang);
  document.documentElement.lang = lang;
  applyDom();
  for (const fn of listeners) fn(lang);
}

export function onLangChange(fn) {
  listeners.push(fn);
}

export function t(key, params) {
  let s = DICTS[current][key] ?? DICTS.en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.replaceAll(`{${k}}`, String(v));
    }
  }
  return s;
}

export function applyDom(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n);
  }
}

export function initI18n() {
  current = detectLang();
  document.documentElement.lang = current;
  applyDom();
}

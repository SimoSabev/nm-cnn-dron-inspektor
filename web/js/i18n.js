// Двуезичност BG/EN. Всички текстове са в strings.js като { ключ: [български, английски] }.
// Bilingual BG/EN. All texts live in strings.js as { key: [Bulgarian, English] }.
import { STRINGS } from './strings.js';

const LANGS = ['bg', 'en'];
const listeners = [];
let lang = initial();

function initial() {
  const q = new URLSearchParams(location.search).get('lang');
  if (LANGS.includes(q)) return q;
  try { const s = localStorage.getItem('lang'); if (LANGS.includes(s)) return s; } catch (e) { /* без localStorage */ }
  return (navigator.language || 'bg').toLowerCase().startsWith('bg') ? 'bg' : 'en';
}

export function getLang() { return lang; }

export function setLang(l) {
  if (!LANGS.includes(l) || l === lang) return;
  lang = l;
  try { localStorage.setItem('lang', l); } catch (e) { /* без localStorage */ }
  document.documentElement.lang = l;
  applyStatic();
  listeners.forEach(fn => fn(l));
}

export function onLang(fn) { listeners.push(fn); }

/** t('ключ', {n: 3}) → текст на текущия език; {n} се заменя. */
export function t(key, vars) {
  const e = STRINGS[key];
  let s = e ? e[lang === 'bg' ? 0 : 1] : key;
  if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}

/** Попълва елементите с data-i18n="ключ" и data-i18n-aria="ключ". */
export function applyStatic(root = document) {
  document.documentElement.lang = lang;
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  root.querySelectorAll('[data-lang]').forEach(el => { el.hidden = el.dataset.lang !== lang; });
  const title = document.querySelector('[data-i18n-title]');
  if (title) document.title = t(title.dataset.i18nTitle) + ' · ' + t('brand');
}

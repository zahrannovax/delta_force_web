/* ============================================================
   Site-wide i18n
   English = HTML source of truth (no fetch / no overwrite)
   Other languages = fetch locale JSON and apply translations
   ============================================================ */

'use strict';

(function () {
  const STORAGE_KEY = 'df_lang';
  const DEFAULT_LANG = 'en';
  const RTL_LANGS = new Set(['ar', 'ur']);

  const SUPPORTED = [
    { code: 'en', label: 'English' },
    { code: 'tr', label: 'Türkçe' },
    { code: 'ar', label: 'العربية' },
    { code: 'de', label: 'Deutsch' },
    { code: 'fr', label: 'Français' },
    { code: 'es', label: 'Español' },
    { code: 'pt', label: 'Português' },
    { code: 'ru', label: 'Русский' },
    { code: 'ja', label: '日本語' },
    { code: 'zh', label: '中文' },
    { code: 'hi', label: 'हिन्दी' },
    { code: 'ur', label: 'اردو' },
    { code: 'id', label: 'Bahasa Indonesia' },
    { code: 'pl', label: 'Polski' },
    { code: 'nl', label: 'Nederlands' },
    { code: 'it', label: 'Italiano' },
  ];

  const cache = Object.create(null);
  let englishCached = false;
  let englishTitle = '';

  function getSavedLang() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && SUPPORTED.some((l) => l.code === saved)) return saved;
    } catch (_) { /* private mode */ }
    return DEFAULT_LANG;
  }

  function saveLang(code) {
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch (_) { /* ignore */ }
  }

  /** Snapshot current (English) DOM text once, before any translation. */
  function cacheEnglishDefaults() {
    if (englishCached) return;

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.setAttribute('data-i18n-default', el.textContent);
    });
    document.querySelectorAll('[data-i18n-html]').forEach((el) => {
      el.setAttribute('data-i18n-html-default', el.innerHTML);
    });
    document.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
      el.setAttribute('data-i18n-aria-default', el.getAttribute('aria-label') || '');
    });
    document.querySelectorAll('[data-i18n-alt]').forEach((el) => {
      el.setAttribute('data-i18n-alt-default', el.getAttribute('alt') || '');
    });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      el.setAttribute('data-i18n-title-default', el.getAttribute('title') || '');
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.setAttribute('data-i18n-placeholder-default', el.getAttribute('placeholder') || '');
    });

    englishTitle = document.title;
    englishCached = true;
  }

  /** Restore HTML English content — no network request. */
  function restoreEnglish() {
    document.querySelectorAll('[data-i18n-default]').forEach((el) => {
      el.textContent = el.getAttribute('data-i18n-default') || '';
    });
    document.querySelectorAll('[data-i18n-html-default]').forEach((el) => {
      el.innerHTML = el.getAttribute('data-i18n-html-default') || '';
    });
    document.querySelectorAll('[data-i18n-aria-default]').forEach((el) => {
      const v = el.getAttribute('data-i18n-aria-default');
      if (v) el.setAttribute('aria-label', v);
      else el.removeAttribute('aria-label');
    });
    document.querySelectorAll('[data-i18n-alt-default]').forEach((el) => {
      el.setAttribute('alt', el.getAttribute('data-i18n-alt-default') || '');
    });
    document.querySelectorAll('[data-i18n-title-default]').forEach((el) => {
      const v = el.getAttribute('data-i18n-title-default');
      if (v) el.setAttribute('title', v);
      else el.removeAttribute('title');
    });
    document.querySelectorAll('[data-i18n-placeholder-default]').forEach((el) => {
      el.setAttribute('placeholder', el.getAttribute('data-i18n-placeholder-default') || '');
    });

    if (englishTitle) document.title = englishTitle;
  }

  async function fetchLocale(code) {
    if (cache[code]) return cache[code];

    try {
      const res = await fetch(`/locales/${code}.json`, { cache: 'force-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      cache[code] = data;
      return data;
    } catch (err) {
      console.warn(`[i18n] Failed to load ${code}.json`, err);
      return null;
    }
  }

  function t(dict, key) {
    return key && dict[key] != null ? dict[key] : null;
  }

  function applyTranslations(dict) {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const val = t(dict, el.getAttribute('data-i18n'));
      if (val != null) el.textContent = val;
    });

    document.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const val = t(dict, el.getAttribute('data-i18n-html'));
      if (val != null) el.innerHTML = val;
    });

    document.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
      const val = t(dict, el.getAttribute('data-i18n-aria-label'));
      if (val != null) el.setAttribute('aria-label', val);
    });
    document.querySelectorAll('[data-i18n-alt]').forEach((el) => {
      const val = t(dict, el.getAttribute('data-i18n-alt'));
      if (val != null) el.setAttribute('alt', val);
    });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const val = t(dict, el.getAttribute('data-i18n-title'));
      if (val != null) el.setAttribute('title', val);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const val = t(dict, el.getAttribute('data-i18n-placeholder'));
      if (val != null) el.setAttribute('placeholder', val);
    });

    const pageTitleKey = document.documentElement.getAttribute('data-i18n-title-key');
    if (pageTitleKey) {
      const titleVal = t(dict, pageTitleKey);
      if (titleVal != null) document.title = titleVal;
    }
  }

  function applyDocumentLang(code) {
    const html = document.documentElement;
    html.setAttribute('lang', code);
    html.setAttribute('dir', RTL_LANGS.has(code) ? 'rtl' : 'ltr');
  }

  function syncSwitcherUI(code) {
    const meta = SUPPORTED.find((l) => l.code === code) || SUPPORTED[0];
    const labelEl = document.getElementById('lang-current-label');
    if (labelEl) labelEl.textContent = meta.label;

    document.querySelectorAll('.lang-option').forEach((btn) => {
      const active = btn.getAttribute('data-lang') === code;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  async function setLanguage(code) {
    const safe = SUPPORTED.some((l) => l.code === code) ? code : DEFAULT_LANG;

    applyDocumentLang(safe);
    syncSwitcherUI(safe);
    saveLang(safe);

    // English: keep HTML as-is — no JSON fetch, no DOM overwrite
    if (safe === DEFAULT_LANG) {
      if (englishCached) restoreEnglish();
      return;
    }

    // Non-English: snapshot English once, then fetch + apply locale
    cacheEnglishDefaults();
    const dict = await fetchLocale(safe);
    if (dict) applyTranslations(dict);
  }

  function closeDropdown(root) {
    root.classList.remove('is-open');
    const trigger = root.querySelector('.lang-trigger');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }

  function initSwitcher() {
    const root = document.getElementById('lang-switcher');
    if (!root) return;

    const trigger = root.querySelector('.lang-trigger');
    const menu = root.querySelector('.lang-menu');
    if (!trigger || !menu) return;

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = root.classList.toggle('is-open');
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    menu.addEventListener('click', (e) => {
      const btn = e.target.closest('.lang-option');
      if (!btn) return;
      const code = btn.getAttribute('data-lang');
      if (code) setLanguage(code);
      closeDropdown(root);
    });

    document.addEventListener('click', () => closeDropdown(root));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDropdown(root);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initSwitcher();
    setLanguage(getSavedLang());
  });

  window.DF_I18N = { setLanguage, getSavedLang, SUPPORTED };
})();

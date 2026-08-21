// Lightweight i18n core for the online FaceRest build.
//
// Deliberately dependency-free: the app is a single SPA with a few hundred
// strings, no plural-rule complexity and no need for runtime bundle splitting,
// so a full i18n framework would add weight without solving a problem here.
//
// Adding a language means adding one dictionary file and one LOCALES entry --
// no component ever branches on the active locale.

import { en } from './locales/en.js';
import { zhHant } from './locales/zhHant.js';

export const DEFAULT_LOCALE = 'en';

// `htmlLang` is what lands in <html lang>; `shortLabel` is what the landing
// switcher renders.
export const LOCALES = Object.freeze({
  en: Object.freeze({
    id: 'en',
    htmlLang: 'en',
    shortLabel: 'EN',
    name: 'English',
    dictionary: en,
  }),
  zhHant: Object.freeze({
    id: 'zhHant',
    htmlLang: 'zh-Hant',
    shortLabel: '中',
    name: '繁體中文',
    dictionary: zhHant,
  }),
});

export const LOCALE_IDS = Object.freeze(Object.keys(LOCALES));

export const LOCALE_STORAGE_KEY = 'facerest.locale';

export function isSupportedLocale(localeId) {
  return Object.prototype.hasOwnProperty.call(LOCALES, localeId);
}

/**
 * The user's stored manual choice, or null when they have never picked one.
 * A stored value for a locale this build no longer ships is ignored.
 */
export function loadStoredLocale() {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isSupportedLocale(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function saveStoredLocale(localeId) {
  if (!isSupportedLocale(localeId)) return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, localeId);
  } catch {
    // The current page still uses the selected locale when storage is
    // unavailable (private mode, blocked storage); only persistence is lost.
  }
}

/**
 * Browser/system language only -- never IP or geolocation.
 * Any `zh*` tag (zh, zh-TW, zh-HK, zh-Hant-TW, ...) resolves to Traditional
 * Chinese; everything else falls back to English.
 */
export function detectBrowserLocale() {
  const tag = (typeof navigator !== 'undefined'
    && (navigator.languages?.[0] || navigator.language)) || '';
  return String(tag).toLowerCase().startsWith('zh') ? 'zhHant' : DEFAULT_LOCALE;
}

/** stored user preference > browser/system language > English fallback. */
export function resolveInitialLocale() {
  return loadStoredLocale() || detectBrowserLocale();
}

function resolvePath(dictionary, key) {
  return String(key).split('.').reduce(
    (node, segment) => (node && typeof node === 'object' ? node[segment] : undefined),
    dictionary,
  );
}

function interpolate(template, values) {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => (
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match
  ));
}

function applyValues(value, values) {
  if (typeof value === 'string') return interpolate(value, values);
  if (Array.isArray(value)) return value.map((entry) => applyValues(entry, values));
  return value;
}

/**
 * Builds the `t` bound to one locale. Lookup order is the active dictionary,
 * then English, then the key itself so a missing string can never blank out a
 * screen or crash a render.
 */
export function createTranslator(localeId) {
  const locale = LOCALES[localeId] || LOCALES[DEFAULT_LOCALE];

  return function t(key, values) {
    if (!key) return '';

    const own = resolvePath(locale.dictionary, key);
    if (own !== undefined) return applyValues(own, values);

    const fallback = resolvePath(LOCALES[DEFAULT_LOCALE].dictionary, key);
    if (fallback !== undefined) {
      if (import.meta.env.DEV && locale.id !== DEFAULT_LOCALE) {
        console.warn(`[i18n] missing "${key}" for locale "${locale.id}"; used ${DEFAULT_LOCALE}.`);
      }
      return applyValues(fallback, values);
    }

    if (import.meta.env.DEV) console.warn(`[i18n] unknown key "${key}".`);
    return key;
  };
}

/**
 * DEV-only parity check: every non-default dictionary must define exactly the
 * same key paths as English, so a half-translated screen is caught at startup
 * instead of in front of a user.
 */
export function reportMissingTranslations() {
  if (!import.meta.env.DEV) return;

  const collectKeys = (node, prefix = '', keys = []) => {
    Object.entries(node || {}).forEach(([segment, value]) => {
      const path = prefix ? `${prefix}.${segment}` : segment;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        collectKeys(value, path, keys);
      } else {
        keys.push(path);
      }
    });
    return keys;
  };

  const baseKeys = collectKeys(LOCALES[DEFAULT_LOCALE].dictionary);

  LOCALE_IDS.filter((id) => id !== DEFAULT_LOCALE).forEach((id) => {
    const localeKeys = new Set(collectKeys(LOCALES[id].dictionary));
    const missing = baseKeys.filter((key) => !localeKeys.has(key));
    const extra = [...localeKeys].filter((key) => !baseKeys.includes(key));
    if (missing.length) console.warn(`[i18n] "${id}" is missing ${missing.length} key(s):`, missing);
    if (extra.length) console.warn(`[i18n] "${id}" has ${extra.length} key(s) English does not:`, extra);
  });
}

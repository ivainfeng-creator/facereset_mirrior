import { useCallback, useEffect, useMemo, useState } from 'react';
import { LocaleContext } from './context.js';
import {
  createTranslator,
  DEFAULT_LOCALE,
  isSupportedLocale,
  LOCALES,
  reportMissingTranslations,
  resolveInitialLocale,
  saveStoredLocale,
} from './index.js';

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(resolveInitialLocale);

  // <html lang> follows the active locale for assistive tech and font/line-break
  // selection; `data-locale` is what the CJK typography rules in styles.css key
  // off, so those overrides can never leak into the English rendering.
  useEffect(() => {
    const { htmlLang } = LOCALES[locale] || LOCALES[DEFAULT_LOCALE];
    document.documentElement.lang = htmlLang;
    document.documentElement.dataset.locale = locale;
  }, [locale]);

  useEffect(() => {
    reportMissingTranslations();
  }, []);

  const setLocale = useCallback((nextLocale) => {
    if (!isSupportedLocale(nextLocale)) return;
    saveStoredLocale(nextLocale);
    setLocaleState(nextLocale);
  }, []);

  const value = useMemo(() => ({
    locale,
    setLocale,
    t: createTranslator(locale),
  }), [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

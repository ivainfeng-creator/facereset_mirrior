import { useI18n } from '../i18n/context.js';
import { LOCALE_IDS, LOCALES } from '../i18n/index.js';
import { playSceneEffect } from '../utils/audioManager.js';

const LANGUAGE_SELECT_EFFECT = Object.freeze({
  source: '/audio/Overall/Click-2.mp3',
  volume: 0.55,
});

// Landing-only control. Rendering it once, on the first screen, keeps every
// gameplay surface free of chrome while still letting a returning visitor
// change their mind before starting a session.
export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="language-switcher" role="group" aria-label={t('language.label')}>
      {LOCALE_IDS.map((id, index) => (
        <span key={id}>
          {index > 0 && <i className="language-switcher-divider" aria-hidden="true">|</i>}
          <button
            className={`language-switcher-option${id === locale ? ' is-active' : ''}`}
            type="button"
            lang={LOCALES[id].htmlLang}
            aria-pressed={id === locale}
            aria-label={t('language.switchTo', { language: LOCALES[id].name })}
            onClick={() => {
              if (id === locale) return;
              playSceneEffect(LANGUAGE_SELECT_EFFECT);
              setLocale(id);
            }}
          >
            {LOCALES[id].shortLabel}
          </button>
        </span>
      ))}
    </div>
  );
}

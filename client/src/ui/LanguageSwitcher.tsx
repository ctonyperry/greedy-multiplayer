import { useI18n, Language } from '../i18n/index.js';

/**
 * LanguageSwitcher - Compact language toggle
 *
 * Features:
 * - Shows current language flag/code
 * - Single tap to switch
 * - Accessible button with aria-label
 */
export function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n();

  const toggleLanguage = () => {
    const newLang: Language = language === 'en' ? 'pt' : 'en';
    setLanguage(newLang);
  };

  const currentFlag = language === 'en' ? '🇺🇸' : '🇧🇷';
  const currentLabel = language === 'en' ? 'EN' : 'PT';
  const nextLanguage = language === 'en' ? t('portuguese') : t('english');

  return (
    <button
      onClick={toggleLanguage}
      className="btn btn-ghost btn-sm"
      aria-label={`${t('language')}: ${currentLabel}. ${nextLanguage}`}
      title={`${t('language')}: ${nextLanguage}`}
      style={{
        minHeight: 44,
        minWidth: 44,
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
        fontSize: 'var(--font-size-sm)',
      }}
    >
      <span aria-hidden="true">{currentFlag}</span>
      <span>{currentLabel}</span>
    </button>
  );
}

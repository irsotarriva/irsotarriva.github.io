/**
 * @brief Ensure a global translations container exists.
 * @return {void}
 * @public
 */
if (window.__translationsJsLoaded) {
    console.info('[i18n] translations.js already loaded; skipping re-execution.');
} else {
    window.__translationsJsLoaded = true;

    window.translations = window.translations || {};

    /**
     * @brief Register or merge translations for a language without overwriting existing keys.
     * @param {string} lang - Language code like 'en' or 'es'.
     * @param {Object} dict - Key/value translation dictionary.
     * @return {void}
     * @public
     */
    function registerTranslations(langOrMap, dict) {
        // If the first argument is a map of languages (header currently calls this form)
        if (langOrMap && typeof langOrMap === 'object' && !dict) {
            const firstLang = Object.keys(langOrMap)[0];
            const firstKey = firstLang ? Object.keys(langOrMap[firstLang] || {})[0] : undefined;
            console.info('[i18n] registerTranslations called (map).', { firstLang, firstKey });

            Object.keys(langOrMap).forEach(lang => {
                window.translations[lang] = Object.assign({}, window.translations[lang] || {}, langOrMap[lang] || {});
            });
            return;
        }
        // If called with (lang, dict)
        if (typeof langOrMap === 'string' && dict && typeof dict === 'object') {
            const firstKey = Object.keys(dict || {})[0];
            console.info('[i18n] registerTranslations called (lang).', { lang: langOrMap, firstKey });

            window.translations[langOrMap] = Object.assign({}, window.translations[langOrMap] || {}, dict);
        }
    }

    /**
     * @brief Translate all elements with data-i18n using the translations registry.
     * @param {string} language - Language code to translate to.
     * @return {void}
     * @public
     */
    function translatePage(language) {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const text = (window.translations[language] && window.translations[language][key])
                || (window.translations['en'] && window.translations['en'][key])
                || key;
            el.textContent = text;
        });
        try {
            document.dispatchEvent(new CustomEvent('languageChanged', { detail: language }));
        } catch (e) { /* ignore environments without CustomEvent */ }
    }

    // Replace top-level const with an IIFE so re-loading doesn't redeclare globals
    (function attachLanguageListenerIfNeeded() {
        const langElLocal = document.getElementById('languageSelect');
        if (!langElLocal) return;
        if (langElLocal.__i18nListenerAdded) return;
        langElLocal.__i18nListenerAdded = true;
        langElLocal.addEventListener('change', (e) => translatePage(e.target.value));
    })();
}


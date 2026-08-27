import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import ar from "./ar.json";
import en from "./en.json";

export const LANGUAGES = ["en", "ar"] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANG_KEY = "crm.lang";

const isLanguage = (value: unknown): value is Language =>
  typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);

/** What the user last chose, or `null` if they never have. */
export const readStoredLanguage = (): Language | null => {
  try {
    const stored = window.localStorage.getItem(LANG_KEY);
    return isLanguage(stored) ? stored : null;
  } catch {
    return null;
  }
};

export const storeLanguage = (lang: Language) => {
  try {
    window.localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* memory-only session. */
  }
};

/**
 * Persisted choice → browser default → English.
 *
 * The persisted choice wins over everything including the profile's `language`
 * field, which LanguageToggle only applies when nothing is stored yet. A user
 * who toggles to English should not find Arabic again on their next visit
 * because their Django profile still says `ar`.
 */
const initialLanguage = (): Language => {
  const stored = readStoredLanguage();
  if (stored) return stored;
  const browser = typeof navigator !== "undefined" ? navigator.language : "";
  return browser.toLowerCase().startsWith("ar") ? "ar" : "en";
};

/** `<html lang>` and `<html dir>` are the one switch the whole RTL flip hangs on. */
export const applyDocumentLanguage = (lang: Language) => {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
};

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ar: { translation: ar } },
  lng: initialLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

applyDocumentLanguage(i18n.language as Language);

export default i18n;

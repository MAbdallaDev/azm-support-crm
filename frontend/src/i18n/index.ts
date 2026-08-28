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
  // i18next's default on a missing key is to render the key itself
  // ("tickets.newTitle" on screen) rather than fail — which reads as
  // placeholder text, not as an error, and survives a whole story's manual
  // verification unless someone happens to read that exact string (this is
  // exactly how story 08's `common.english`/`common.arabic` gap went
  // unnoticed for a full story). Throwing in development turns a missing key
  // into a visible crash during the Arabic sweep instead of a silent typo;
  // production only logs, since a customer-facing screen should degrade to
  // the raw key rather than a blank error boundary over one missing string.
  saveMissing: true,
  missingKeyHandler: (_lngs, _ns, key) => {
    const message = `i18next: missing key "${key}"`;
    if (import.meta.env.DEV) throw new Error(message);
    console.error(message);
  },
});

applyDocumentLanguage(i18n.language as Language);

export default i18n;

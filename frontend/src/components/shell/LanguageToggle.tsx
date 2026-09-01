import * as React from "react";
import { useTranslation } from "react-i18next";

import { applyDocumentLanguage, readStoredLanguage, storeLanguage } from "@/i18n";
import type { Language } from "@/i18n";
import { cn } from "@/lib/utils";

/**
 * The `EN` / `ع` two-state toggle from Main.dc.html — 32px tall, the active
 * half filled `#14171f` with white text.
 *
 * Changing language does three things, and all three have to happen together:
 * i18next switches its resource bundle, `<html>` gets a new `lang` **and**
 * `dir`, and the choice is persisted. Missing the `dir` is how you get Arabic
 * text in a left-to-right layout, which looks like a CSS bug and is not one.
 */

export type LanguageToggleProps = {
  /**
   * `useMe()`'s `language` field. Applied **once**, and only if the user has
   * never toggled: an explicit choice outranks a profile default, or a user
   * who switched to English finds Arabic again on every visit because Django
   * still says `ar`. Arrives undefined while `/auth/me/` is in flight.
   */
  profileLanguage?: Language;
  className?: string;
};

/**
 * The switching logic on its own, so a narrow-screen menu (AppChrome's mobile
 * dropdown) can offer the same two choices without re-rendering the 32px
 * segmented control there's no room for below `sm`.
 */
export function useLanguageSwitch(profileLanguage?: Language) {
  const { i18n } = useTranslation();
  const current = (i18n.language ?? "en").startsWith("ar") ? "ar" : "en";

  const applied = React.useRef(false);

  React.useEffect(() => {
    if (applied.current || profileLanguage === undefined) return;
    applied.current = true;
    if (readStoredLanguage() !== null) return;

    void i18n.changeLanguage(profileLanguage);
    applyDocumentLanguage(profileLanguage);
    // Deliberately NOT persisted. Persisting here would make the profile
    // default indistinguishable from a choice the user made, and the next
    // profile change would then be ignored forever.
  }, [profileLanguage, i18n]);

  const select = (lang: Language) => {
    if (lang === current) return;
    void i18n.changeLanguage(lang);
    applyDocumentLanguage(lang);
    storeLanguage(lang);
  };

  return { current, select };
}

export function LanguageToggle({ profileLanguage, className }: LanguageToggleProps) {
  const { t } = useTranslation();
  const { current, select } = useLanguageSwitch(profileLanguage);

  const half = (lang: Language, extra: string) =>
    cn(
      "flex h-8 items-center px-[11px] font-semibold transition-colors",
      lang === current ? "bg-ink text-white" : "text-muted-foreground hover:bg-surface-2",
      extra,
    );

  return (
    <div
      className={cn("flex flex-none overflow-hidden rounded-lg border border-line", className)}
      role="group"
      aria-label={t("common.language")}
    >
      <button
        type="button"
        onClick={() => select("en")}
        aria-pressed={current === "en"}
        className={half("en", "text-[12px]")}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => select("ar")}
        aria-pressed={current === "ar"}
        className={half("ar", "text-[13px]")}
      >
        ع
      </button>
    </div>
  );
}

import i18n from "@/i18n";

/**
 * The one place dates, durations and numbers are formatted.
 *
 * Nothing else in `src/` calls `Intl.*` directly. Two reasons, and the second
 * is the one that bites:
 *
 *  1. The choice is made once. A screen that formats a timestamp inline is a
 *     screen that formats it differently from the one beside it.
 *  2. **Numerals stay Western (0–9) in both languages.** `Intl` with an `ar`
 *     locale renders Arabic-Indic digits (٤٧٩٦), which the design does not use
 *     — a ticket number, a phone number and an SLA countdown all have to stay
 *     legible to an English-speaking colleague reading over the shoulder.
 *     Pinning the *numbering system* rather than the locale keeps Arabic month
 *     names while keeping Latin digits.
 */

/** `ar` with Latin digits; `en` untouched. */
const localeFor = (lang: string) => (lang.startsWith("ar") ? "ar-u-nu-latn" : "en");

const activeLocale = () => localeFor(i18n.language ?? "en");

export const formatDate = (value: string | number | Date): string =>
  new Intl.DateTimeFormat(activeLocale(), {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));

export const formatDateTime = (value: string | number | Date): string =>
  new Intl.DateTimeFormat(activeLocale(), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

export const formatNumber = (value: number): string =>
  new Intl.NumberFormat(activeLocale()).format(value);

/**
 * A duration in seconds as the design writes it: `4h 05m`, `38m`, `2d 3h`.
 *
 * Takes the **absolute** value on purpose. SLA seconds are signed, and the
 * sign chooses the sentence ("2h left" vs "Breached 14m"), not the number —
 * so the caller picks the translation key and this returns the magnitude.
 */
export const formatDuration = (seconds: number): string => {
  const total = Math.max(0, Math.floor(Math.abs(seconds)));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${total}s`;
};

/** "2 hours ago" / "in 20 minutes", same numeral rule. */
export const formatRelative = (value: string | number | Date): string => {
  const deltaSeconds = (new Date(value).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(activeLocale(), { numeric: "auto" });

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(deltaSeconds) >= size) return rtf.format(Math.round(deltaSeconds / size), unit);
  }
  return rtf.format(Math.round(deltaSeconds), "second");
};

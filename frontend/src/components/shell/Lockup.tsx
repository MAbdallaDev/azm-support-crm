import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

/**
 * The `AZ` mark + `AZM Squad` wordmark + secondary product label.
 *
 * **The wordmark is never translated.** It is a brand name; the Arabic
 * artboard keeps it in Latin script and translates only the label beside it.
 */
export function Lockup({ product, className }: { product: string; className?: string }) {
  const { t } = useTranslation();

  return (
    <div className={cn("flex flex-none items-center gap-[9px]", className)}>
      <div
        aria-hidden
        className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-ink text-[11px] font-bold tracking-[0.03em] text-white"
      >
        AZ
      </div>
      <span className="text-[14px] font-bold" dir="ltr">
        {t("app.brand")}
      </span>
      {/* The secondary label is the first thing to go on a narrow phone —
          the wordmark alone still identifies the product, and this is what
          buys the header the room a nav collapse or language toggle needs. */}
      <span aria-hidden className="hidden h-4 w-px bg-line sm:block" />
      <span className="hidden text-[13px] text-muted-foreground sm:inline">{product}</span>
    </div>
  );
}

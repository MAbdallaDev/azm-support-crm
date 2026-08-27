import { Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

/**
 * The "nothing here" panel. Callers pass already-translated strings — the
 * component cannot know which key describes *their* emptiness — and the
 * defaults are translated here so a caller with nothing specific to say still
 * renders bilingual text.
 */
export type EmptyStateProps = {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const { t } = useTranslation();

  return (
    <div
      data-testid="empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-6 py-12 text-center",
        className,
      )}
    >
      <Icon aria-hidden className="h-8 w-8 text-faint" />
      <p className="text-[14px] font-semibold">{title ?? t("empty.title")}</p>
      <p className="max-w-sm text-[12.5px] text-muted-foreground">
        {description ?? t("empty.body")}
      </p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

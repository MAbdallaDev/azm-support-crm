import { useTranslation } from "react-i18next";

import type { TicketEvent } from "@/api/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDateTime } from "@/lib/format";

/**
 * The Activity log, rendered as **sentences** rather than field diffs.
 *
 * "Omar changed the status from New to Escalated" is what an agent scanning a
 * history needs; `status: new → escalated` makes them do the translation
 * themselves, twice — once from the field name and once from the enum key.
 *
 * `old_value` / `new_value` arrive as enum keys, so they go back through the
 * existing `status.*` / `priority.*` keys. Printing `on_hold` raw would leak a
 * database value into the UI, and in Arabic it would leak an English one.
 *
 * Rendered in the order the API sends them — **newest first**
 * (`TicketEvent.Meta.ordering = ["-created_at"]`). What just happened is what
 * an agent opening this tab is looking for; re-sorting here would also mean
 * the client and the server disagreed about the order for no gain.
 */

/** Event types that carry a translatable enum in old/new_value. */
const ENUM_NAMESPACE: Record<string, "status" | "priority"> = {
  status_changed: "status",
  priority_changed: "priority",
};

export function ActivityLog({
  events,
  isPending,
}: {
  events: TicketEvent[];
  isPending: boolean;
}) {
  const { t, i18n } = useTranslation();

  if (isPending) {
    return (
      <div className="space-y-2.5">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return <EmptyState title={t("tickets.noActivity")} description="" />;
  }

  const describe = (event: TicketEvent) => {
    const namespace = ENUM_NAMESPACE[event.event_type];

    /** An enum key through its own namespace; anything else verbatim. */
    const render = (value: string) => {
      if (!value) return "";
      if (!namespace) return value;
      const key = `${namespace}.${value}`;
      // Checked with `i18n.exists`, not by calling `t()` and comparing the
      // result to the key: story 10's `missingKeyHandler` throws in
      // development on a genuinely missing key, and a value the server added
      // that the client has no label for yet is an *expected* miss, not a
      // bug to surface as a crash — it should render as itself instead.
      return i18n.exists(key) ? t(key) : value;
    };

    const values = {
      actor: event.actor_name || t("activity.system"),
      from: render(event.old_value),
      to: render(event.new_value),
    };

    const key = `activity.${event.event_type}`;
    // Unknown event types fall back to a generic sentence rather than
    // rendering blank — a silent gap in a history reads as data loss. Same
    // `i18n.exists` reasoning as `render` above.
    return i18n.exists(key) ? t(key, values) : t("activity.fallback", values);
  };

  return (
    <ol className="space-y-3" data-testid="activity-log">
      {events.map((event) => (
        <li key={event.id} className="flex gap-3 text-[12.5px]">
          <span aria-hidden className="mt-[6px] h-1.5 w-1.5 flex-none rounded-full bg-line" />
          <div className="min-w-0 flex-1">
            <p className="leading-[1.55] text-ink-2">{describe(event)}</p>
            <time
              dateTime={event.created_at}
              className="text-[11px] text-faint"
              dir={i18n.language.startsWith("ar") ? "rtl" : "ltr"}
            >
              {formatDateTime(event.created_at)}
            </time>
          </div>
        </li>
      ))}
    </ol>
  );
}

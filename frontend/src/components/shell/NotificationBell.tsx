import { Bell } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useMarkNotificationRead, useNotifications, useUnreadCount } from "@/api/notifications";
import type { Notification } from "@/api/types";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The bell in `AppChrome`'s header. Two verbs only — assignment and
 * escalation — per `accounts.notifications`' own scope note: SLA breach has
 * no moment at which "a breach just happened" is knowable without a
 * scheduler this project does not have.
 *
 * The list query is `enabled` only while the dropdown is open, so opening the
 * bell is also how the list (and, via the mark-read mutation, the badge)
 * goes fresh — no polling, matching the app's `refetchOnWindowFocus: false`
 * default everywhere else.
 */
export function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { data: unreadCount } = useUnreadCount();
  const { data: notifications, isPending } = useNotifications(open);
  const markRead = useMarkNotificationRead();

  const label = (notification: Notification) => {
    const ticket = notification.ticket_number || notification.ticket_subject;
    if (notification.verb === "ticket_assigned") {
      return notification.actor_name
        ? t("notifications.assigned", { actor: notification.actor_name, ticket })
        : t("notifications.assignedNoActor", { ticket });
    }
    if (notification.verb === "ticket_sla_breached") {
      // Always actor-less — see notify_sla_breach's docstring.
      return t("notifications.slaBreached", { ticket });
    }
    return notification.actor_name
      ? t("notifications.escalated", { actor: notification.actor_name, ticket })
      : t("notifications.escalatedNoActor", { ticket });
  };

  const onSelect = (notification: Notification) => {
    if (notification.read_at === null) {
      markRead.mutate(notification.id);
    }
    if (notification.ticket !== null) {
      navigate(`/app/tickets/${notification.ticket}`);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className="relative flex h-8 w-8 flex-none items-center justify-center rounded-lg hover:bg-surface-3"
        aria-label={t("notifications.title")}
        data-testid="notification-bell"
      >
        <Bell aria-hidden className="h-4 w-4" />
        {unreadCount ? (
          <span
            aria-hidden
            data-testid="notification-unread-badge"
            className="absolute end-1 top-1 h-[7px] w-[7px] rounded-full bg-destructive"
          />
        ) : null}
        <span className="sr-only">{unreadCount ?? 0}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[320px]">
        <DropdownMenuLabel>{t("notifications.title")}</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {isPending ? (
          <div className="space-y-2 p-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !notifications || notifications.length === 0 ? (
          <div className="px-2 py-4 text-center">
            <p className="text-[13px] font-semibold">{t("notifications.empty")}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">{t("notifications.emptyBody")}</p>
          </div>
        ) : (
          <div className="max-h-[320px] overflow-y-auto">
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                data-testid={`notification-${notification.id}`}
                className="flex-col items-start gap-0.5 py-2"
                onSelect={() => onSelect(notification)}
              >
                <span className={cn("text-[12.5px] leading-snug", notification.read_at === null && "font-semibold")}>
                  {label(notification)}
                </span>
                <span className="text-[11px] text-faint">{formatRelative(notification.created_at)}</span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

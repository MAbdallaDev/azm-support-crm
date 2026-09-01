import { Menu } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { useMe } from "@/api/auth";
import { LanguageToggle } from "@/components/shell/LanguageToggle";
import { Lockup } from "@/components/shell/Lockup";
import { portalNavItems, visibleNavItems } from "@/components/shell/navItems";
import { UserChip } from "@/components/shell/UserChip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChatWidgetProvider } from "@/features/portal/ChatWidgetContext";
import { PortalChatWidget } from "@/features/portal/PortalChatWidget";
import { cn } from "@/lib/utils";

/**
 * The customer-portal shell — PortalHome.dc.html's chrome: a 60px bar, a
 * centred 880px column, two nav items, and **no** admin link and no global
 * agent search.
 *
 * Story 09 fills the screens. The shell exists now so the routing split is
 * real from day one: without it both trees would wear the agent chrome, and
 * "story 09 will change it" is exactly the kind of thing that gets forgotten
 * and ships a customer a link to Django admin.
 */

const NAVLINK =
  "rounded-[7px] px-[11px] py-[6px] text-[13px] font-medium text-ink-2 hover:bg-surface-3";
const NAVLINK_ON = "bg-ink font-semibold text-white hover:bg-ink";

export default function PortalChrome() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: me } = useMe();

  const items = visibleNavItems(portalNavItems(), me?.role);

  return (
    <ChatWidgetProvider>
      <div className="flex min-h-screen flex-col bg-surface-2">
        <header className="flex h-[60px] flex-none items-center gap-[10px] border-b border-line bg-background px-4 sm:gap-[18px] sm:px-7">
          <Lockup product={t("app.portalProduct")} className="min-w-0" />

          {/* Below `sm` (640px) two full-width nav labels plus the language
              toggle and the wordmark's secondary label genuinely do not fit
              a phone's ~375px header — they collapse into the menu button
              instead of silently overflowing the page horizontally. */}
          <nav className="hidden items-center gap-[2px] ms-3 sm:flex" aria-label={t("nav.primary")}>
            {items.map((item) => (
              <NavLink
                key={item.key}
                to={item.to}
                end
                className={({ isActive }) => cn(NAVLINK, isActive && NAVLINK_ON)}
              >
                {t(item.labelKey)}
              </NavLink>
            ))}
          </nav>

          <div className="flex-1" />

          <LanguageToggle profileLanguage={me?.language} />

          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex h-8 w-8 flex-none items-center justify-center rounded-lg hover:bg-surface-3 sm:hidden"
              aria-label={t("nav.primary")}
              data-testid="portal-mobile-nav-trigger"
            >
              <Menu aria-hidden className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[12rem]">
              {items.map((item) => (
                <DropdownMenuItem key={item.key} onSelect={() => navigate(item.to)}>
                  {t(item.labelKey)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {me ? <UserChip me={me} compact /> : null}
        </header>

        <main className="min-h-0 flex-1 py-7">
          <div className="mx-auto w-full max-w-[880px] px-4">
            <Outlet />
          </div>
        </main>

        {/* Persists across every portal route — a customer never leaves the
            page they were on to talk to support. */}
        <PortalChatWidget />
      </div>
    </ChatWidgetProvider>
  );
}

import { useTranslation } from "react-i18next";
import { NavLink, Outlet } from "react-router-dom";

import { useMe } from "@/api/auth";
import { LanguageToggle } from "@/components/shell/LanguageToggle";
import { Lockup } from "@/components/shell/Lockup";
import { portalNavItems, visibleNavItems } from "@/components/shell/navItems";
import { UserChip } from "@/components/shell/UserChip";
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
  const { data: me } = useMe();

  const items = visibleNavItems(portalNavItems(), me?.role);

  return (
    <ChatWidgetProvider>
      <div className="flex min-h-screen flex-col bg-surface-2">
        <header className="flex h-[60px] flex-none items-center gap-[18px] border-b border-line bg-background px-7">
          <Lockup product={t("app.portalProduct")} />

          <nav className="flex items-center gap-[2px] ms-3" aria-label={t("nav.primary")}>
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

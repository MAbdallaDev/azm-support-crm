import { Menu } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { useMe } from "@/api/auth";
import { useLiveChatInbox } from "@/api/tickets";
import { GlobalSearch } from "@/components/shell/GlobalSearch";
import { Lockup } from "@/components/shell/Lockup";
import { LanguageToggle, useLanguageSwitch } from "@/components/shell/LanguageToggle";
import { appNavItems, visibleNavItems } from "@/components/shell/navItems";
import { NotificationBell } from "@/components/shell/NotificationBell";
import { UserChip } from "@/components/shell/UserChip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * The agent/manager shell — Main.dc.html's 56px top bar, and the `<Outlet />`
 * every `/app/*` screen renders into.
 *
 * Every spacing value here is the artboard's: 56px bar, 18px gutter, 28px
 * logo mark, a 300px search field, the 32px language toggle, 30px avatar —
 * all at the artboard's own desktop width. **Below `lg` (1024px) the inline
 * nav collapses into a menu button** (`GlobalSearch` already hides itself
 * below `lg` on its own) — six nav links plus the wordmark and the user chip
 * genuinely do not fit in one row at 375px, and shrinking them to fit would
 * make every one of them harder to read rather than making the bar narrower.
 */

const NAVLINK =
  "rounded-[7px] px-[11px] py-[6px] text-[13px] font-medium text-ink-2 hover:bg-surface-3";
const NAVLINK_ON = "bg-ink font-semibold text-white hover:bg-ink";

export default function AppChrome() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const navigate = useNavigate();

  const items = visibleNavItems(appNavItems(), me?.role);

  // Shares `useLiveChatInbox`'s query key with the Live Chat screen itself, so
  // this badge and that page's list are always the same fetch, never two.
  const { data: liveChat } = useLiveChatInbox();
  const awaitingReplyCount = (liveChat ?? []).filter((c) => c.awaiting_reply).length;

  // Below `sm` the 32px segmented EN/ع control has nowhere left to go —
  // Lockup's secondary label is already gone and the nav is already a menu
  // button. Folded into that same menu below `sm` instead of losing the
  // ability to switch language on a phone entirely.
  const { current: currentLanguage, select: selectLanguage } = useLanguageSwitch(me?.language);

  return (
    <div className="flex h-screen flex-col bg-surface-2">
      <header className="flex h-14 flex-none items-center gap-[10px] border-b border-line bg-background px-[14px] lg:gap-[18px] lg:px-[18px]">
        <Lockup product={t("app.product")} className="min-w-0" />

        <nav className="hidden items-center gap-[2px] ms-[14px] lg:flex" aria-label={t("nav.primary")}>
          {items.map((item) =>
            item.external ? (
              // Django admin is not a client route — a <Link> here would push
              // a path React Router has no match for and blank the screen.
              <a key={item.key} href={item.to} className={NAVLINK}>
                {t(item.labelKey)}
              </a>
            ) : (
              <NavLink
                key={item.key}
                to={item.to}
                className={({ isActive }) => cn(NAVLINK, "flex items-center gap-1.5", isActive && NAVLINK_ON)}
              >
                {t(item.labelKey)}
                {item.key === "live-chat" && awaitingReplyCount > 0 ? (
                  <span
                    data-testid="live-chat-nav-badge"
                    className="inline-flex min-w-[16px] items-center justify-center rounded-full bg-channel-chat px-[5px] py-px text-[10px] font-bold leading-[16px] text-white"
                  >
                    {awaitingReplyCount}
                  </span>
                ) : null}
              </NavLink>
            ),
          )}
        </nav>

        <div className="flex-1" />

        <GlobalSearch />

        <LanguageToggle profileLanguage={me?.language} className="hidden sm:flex" />

        <NotificationBell />

        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg hover:bg-surface-3 lg:hidden"
            aria-label={t("nav.primary")}
            data-testid="mobile-nav-trigger"
          >
            <Menu aria-hidden className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[12rem]">
            {items.map((item) =>
              item.external ? (
                <DropdownMenuItem key={item.key} asChild>
                  <a href={item.to}>{t(item.labelKey)}</a>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem key={item.key} onSelect={() => navigate(item.to)}>
                  {t(item.labelKey)}
                  {item.key === "live-chat" && awaitingReplyCount > 0 ? (
                    <span className="ms-auto inline-flex min-w-[16px] items-center justify-center rounded-full bg-channel-chat px-[5px] py-px text-[10px] font-bold leading-[16px] text-white">
                      {awaitingReplyCount}
                    </span>
                  ) : null}
                </DropdownMenuItem>
              ),
            )}
            <DropdownMenuItem
              className="sm:hidden"
              onSelect={() => selectLanguage(currentLanguage === "en" ? "ar" : "en")}
            >
              {currentLanguage === "en" ? "العربية" : "English"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {me ? <UserChip me={me} /> : null}
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

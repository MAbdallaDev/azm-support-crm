import { useTranslation } from "react-i18next";
import { NavLink, Outlet } from "react-router-dom";

import { useMe } from "@/api/auth";
import { GlobalSearch } from "@/components/shell/GlobalSearch";
import { Lockup } from "@/components/shell/Lockup";
import { LanguageToggle } from "@/components/shell/LanguageToggle";
import { appNavItems, visibleNavItems } from "@/components/shell/navItems";
import { UserChip } from "@/components/shell/UserChip";
import { cn } from "@/lib/utils";

/**
 * The agent/manager shell — Main.dc.html's 56px top bar, and the `<Outlet />`
 * every `/app/*` screen renders into.
 *
 * Every spacing value here is the artboard's: 56px bar, 18px gutter, 28px
 * logo mark, a 300px search field, the 32px language toggle, 30px avatar.
 */

const NAVLINK =
  "rounded-[7px] px-[11px] py-[6px] text-[13px] font-medium text-ink-2 hover:bg-surface-3";
const NAVLINK_ON = "bg-ink font-semibold text-white hover:bg-ink";

export default function AppChrome() {
  const { t } = useTranslation();
  const { data: me } = useMe();

  const items = visibleNavItems(appNavItems(), me?.role);

  return (
    <div className="flex min-h-screen flex-col bg-surface-2">
      <header className="flex h-14 flex-none items-center gap-[18px] border-b border-line bg-background px-[18px]">
        <Lockup product={t("app.product")} />

        <nav className="flex items-center gap-[2px] ms-[14px]" aria-label={t("nav.primary")}>
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
                className={({ isActive }) => cn(NAVLINK, isActive && NAVLINK_ON)}
              >
                {t(item.labelKey)}
              </NavLink>
            ),
          )}
        </nav>

        <div className="flex-1" />

        <GlobalSearch />

        <LanguageToggle profileLanguage={me?.language} />

        {me ? <UserChip me={me} /> : null}
      </header>

      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}

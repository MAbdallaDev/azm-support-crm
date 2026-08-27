import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet } from "react-router-dom";

import { useMe } from "@/api/auth";
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

        {/*
          Inert this story: there is no global search endpoint to call, and the
          tickets list it would filter does not exist until story 07. Rendered
          now so the chrome matches the artboard; wired there.
        */}
        <label className="hidden w-[300px] items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 lg:flex">
          <Search aria-hidden className="h-3.5 w-3.5 text-faint" />
          <input
            type="search"
            disabled
            placeholder={t("nav.search")}
            aria-label={t("nav.search")}
            className="h-[34px] w-full bg-transparent text-[12.5px] outline-none placeholder:text-faint"
          />
        </label>

        <LanguageToggle profileLanguage={me?.language} />

        {me ? <UserChip me={me} /> : null}
      </header>

      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}

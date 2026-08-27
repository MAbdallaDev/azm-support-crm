import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useLogout } from "@/api/auth";
import type { Me } from "@/api/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, initials } from "@/lib/utils";

/**
 * The 30px avatar + name + "Tier 2 · Billing" subtext from Main.dc.html, with
 * the profile / sign-out menu behind it.
 *
 * `department` is a **code string** off `MeSerializer`, not an object — it
 * renders as-is rather than through `department.name`, which does not exist.
 */
export function UserChip({ me, compact = false }: { me: Me; compact?: boolean }) {
  const { t } = useTranslation();
  const logout = useLogout();
  const navigate = useNavigate();

  const subtext = [t("user.tier", { tier: me.tier }), me.department]
    .filter(Boolean)
    .join(" · ");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex flex-none items-center gap-[9px] rounded-lg px-1 py-1 hover:bg-surface-3"
        aria-label={t("user.menu")}
      >
        <span
          aria-hidden
          className={cn(
            "flex flex-none items-center justify-center rounded-full bg-[#2f3a56] text-[11px] font-semibold text-white",
            compact ? "h-7 w-7" : "h-[30px] w-[30px]",
          )}
        >
          {initials(me.full_name)}
        </span>
        <span className="text-start leading-[1.3]">
          <span className="block text-[12.5px] font-semibold">{me.full_name}</span>
          {compact ? null : (
            <span className="block text-[11px] text-muted-foreground">{subtext}</span>
          )}
        </span>
        <ChevronDown aria-hidden className="h-3 w-3 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-[12rem]">
        <DropdownMenuLabel>{me.email || me.username}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate("/app/profile")}>
          {t("user.profile")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => logout()}>{t("user.signOut")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { useTranslation } from "react-i18next";

import { useMe } from "@/api/auth";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * A no-op destination for the user menu's "Profile" item, so the link goes
 * somewhere rather than rendering an empty shell. Editing a profile is Django
 * admin's job in this MVP — see the brief's "admin is the back-office" call.
 */
export default function Profile() {
  const { t } = useTranslation();
  const { data: me } = useMe();

  return (
    <div className="p-6">
      <h1 className="text-[22px] font-bold tracking-[-0.01em]">{t("user.profile")}</h1>
      <EmptyState
        className="mt-5 rounded-[9px] border border-line bg-background"
        title={me?.full_name}
      />
    </div>
  );
}

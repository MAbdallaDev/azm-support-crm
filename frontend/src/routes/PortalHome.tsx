import { useTranslation } from "react-i18next";

import { EmptyState } from "@/components/ui/EmptyState";

/** Placeholder. The customer portal's screens are story 09. */
export default function PortalHome() {
  const { t } = useTranslation();

  return (
    <section>
      <h1 className="text-[22px] font-bold tracking-[-0.01em]">{t("portal.home")}</h1>
      <EmptyState className="mt-6 rounded-[9px] border border-line bg-background" description={t("portal.placeholder")} />
    </section>
  );
}

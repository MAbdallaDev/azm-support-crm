import { Construction } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * The catch-all inside each shell.
 *
 * Story 06 ships nav items whose screens arrive in stories 07–09. Without this
 * route, clicking one throws React Router's own error page — which takes the
 * chrome down with it and reads as a crash rather than as "not built yet".
 * Rendered as a child of the layout route, the header and nav stay up and the
 * user can simply click somewhere else.
 */
export default function NotFound({ home = "/app/dashboard" }: { home?: string }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  return (
    <div className="p-6">
      <EmptyState
        className="rounded-[9px] border border-line bg-background"
        icon={Construction}
        title={t("notFound.title")}
        description={t("notFound.body", { path: pathname })}
        action={
          <Button asChild variant="outline">
            <Link to={home}>{t("notFound.back")}</Link>
          </Button>
        }
      />
    </div>
  );
}

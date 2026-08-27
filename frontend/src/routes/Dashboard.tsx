import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { getHealth } from "@/api/client";
import { qk } from "@/api/queryKeys";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Placeholder. The real agent dashboard is story 07.
 *
 * The health card stays: it is this story's own smoke test that the API client
 * still works now that a request interceptor and a refresh flow sit in front
 * of it. Browser → Vite → axios (+ Authorization header) → CORS → DRF →
 * Postgres, in one glance.
 */
export default function Dashboard() {
  const { t } = useTranslation();
  const { data, isPending, isError } = useQuery({
    queryKey: qk.health,
    queryFn: getHealth,
  });

  const value = (key: "status" | "database") => {
    if (isPending) return t("health.checking");
    if (isError || !data) return t("health.unreachable");
    return data[key];
  };

  return (
    <div className="p-6">
      <h1 className="text-[22px] font-bold tracking-[-0.01em]">{t("nav.dashboard")}</h1>
      <Card className="mt-5 w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-[15px]">{t("app.name")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">{t("health.api")}</span>
            <span data-testid="health-status">{value("status")}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">{t("health.database")}</span>
            <span data-testid="health-database">{value("database")}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

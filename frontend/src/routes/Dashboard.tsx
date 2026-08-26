import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { getHealth } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Placeholder. The real agent dashboard is story 07.
 *
 * The one live call below proves the whole chain in a single glance:
 * browser -> Vite -> axios -> CORS -> DRF -> Postgres.
 */
export default function Dashboard() {
  const { t } = useTranslation();
  const { data, isPending, isError } = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
  });

  const value = (key: "status" | "database") => {
    if (isPending) return t("health.checking");
    if (isError || !data) return t("health.unreachable");
    return data[key];
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("nav.dashboard")}</h1>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t("app.name")}</CardTitle>
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
    </main>
  );
}

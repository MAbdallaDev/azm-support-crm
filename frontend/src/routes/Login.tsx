import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

/** Placeholder. The real login form is story 06. */
export default function Login() {
  const { t } = useTranslation();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("nav.login")}</h1>
      <p className="text-sm text-muted-foreground">{t("app.name")}</p>
      <Button disabled>{t("nav.login")}</Button>
    </main>
  );
}

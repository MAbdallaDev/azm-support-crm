import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";

import { useLogin } from "@/api/auth";
import { homePathForRole } from "@/api/tokenStore";
import { LanguageToggle } from "@/components/shell/LanguageToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pill } from "@/components/ui/pill";

/**
 * Login.dc.html: a 560px `#14171f` pitch panel and the form beside it,
 * collapsing to a single column below `lg`.
 *
 * One screen serves both front doors. `/login` and `/portal/login` differ in
 * their subtitle and their cross-link, not in their mechanics — the API has
 * one login endpoint, and a second copy of this form would be a second place
 * to fix the next time the token shape moves.
 */

/**
 * Deliberately **not** `.email()` on `username`. The field accepts a bare
 * username, and the documented demo logins (`agent@demo`) are usernames that
 * merely look like addresses — `.email()` would reject the exact credentials
 * the box below tells the user to type.
 */
const schema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

/** The seeded shared password, from `backend/apps/tickets/demo_content.py`. */
const DEMO_PASSWORD = "Demo!2345";

export default function Login({ audience = "staff" }: { audience?: "staff" | "customer" }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const login = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "" },
  });

  /** Where ProtectedRoute wanted to go before it bounced the user here. */
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;

  const onSubmit = handleSubmit((values) => {
    login.mutate(values, {
      onSuccess: (data) => navigate(from ?? homePathForRole(data.user.role), { replace: true }),
    });
  });

  const status = login.error instanceof AxiosError ? login.error.response?.status : undefined;
  // Never echo the server's own error text — it distinguishes "no such user"
  // from "wrong password", which is a free account-enumeration oracle.
  const bannerKey =
    login.isError && status !== undefined && status < 500 ? "auth.failed" : "auth.unavailable";

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="flex flex-col bg-ink px-8 py-10 text-white lg:w-[560px] lg:flex-none lg:px-[54px] lg:py-14">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[12px] font-bold text-ink"
          >
            AZ
          </span>
          <span className="text-[16px] font-bold" dir="ltr">
            {t("app.brand")}
          </span>
        </div>

        <div className="flex flex-1 flex-col justify-center py-10">
          <h2 className="text-[30px] font-bold leading-[1.2] tracking-[-0.02em] lg:text-[38px]">
            {t("auth.pitchTitle")}
          </h2>
          <p className="mt-5 max-w-[400px] text-[14px] leading-[1.7] text-faint">
            {t("auth.pitchBody")}
          </p>
          <div className="mt-7 flex flex-wrap gap-2.5">
            {["pitchMultichannel", "pitchSla", "pitchAi", "pitchBilingual"].map((key) => (
              <Pill key={key} className="bg-[#232833] text-[#c9cfda]">
                {t(`auth.${key}`)}
              </Pill>
            ))}
          </div>
        </div>

        <p className="text-[11.5px] text-[#6b7280]">
          {audience === "staff" ? (
            <Link to="/portal/login" className="text-[#c9cfda] underline-offset-4 hover:underline">
              {t("auth.customerHint")}
            </Link>
          ) : (
            <Link to="/login" className="text-[#c9cfda] underline-offset-4 hover:underline">
              {t("auth.agentHint")}
            </Link>
          )}
        </p>
      </aside>

      <div className="flex flex-1 items-center justify-center bg-surface-2 px-6 py-12">
        <div className="w-full max-w-[396px]">
          <h1 className="text-[24px] font-bold tracking-[-0.01em]">{t("auth.signIn")}</h1>
          <p className="mt-[7px] text-[13px] text-muted-foreground">
            {t(audience === "staff" ? "auth.subtitle" : "auth.portalSubtitle")}
          </p>

          {login.isError ? (
            <div
              role="alert"
              className="mt-5 rounded-lg border border-priority-urgent/30 bg-priority-urgent-bg px-3 py-2 text-[12.5px] font-medium text-priority-urgent"
            >
              {t(bannerKey)}
            </div>
          ) : null}

          <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
            <div className="space-y-[7px]">
              <Label htmlFor="username">{t("auth.usernameLabel")}</Label>
              <Input
                id="username"
                autoComplete="username"
                dir="ltr"
                placeholder={t("auth.usernamePlaceholder")}
                aria-invalid={errors.username !== undefined}
                {...register("username")}
              />
              {errors.username ? (
                <p role="alert" className="text-[11.5px] text-priority-urgent">
                  {t("auth.required")}
                </p>
              ) : null}
            </div>

            <div className="space-y-[7px]">
              <Label htmlFor="password">{t("auth.passwordLabel")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                dir="ltr"
                aria-invalid={errors.password !== undefined}
                {...register("password")}
              />
              {errors.password ? (
                <p role="alert" className="text-[11.5px] text-priority-urgent">
                  {t("auth.required")}
                </p>
              ) : null}
            </div>

            {/*
              Disabled for the whole request, not just re-labelled: a
              double-click on a slow connection otherwise fires two logins,
              and the second one's token wins over the first one's redirect.
            */}
            <Button type="submit" disabled={login.isPending} className="h-[42px] w-full text-sm">
              {login.isPending ? (
                <>
                  <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                  {t("auth.submitting")}
                </>
              ) : (
                t("auth.submit")
              )}
            </Button>
          </form>

          <div className="mt-6 rounded-[9px] border border-dashed border-line bg-background px-3.5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-faint">
              {t("auth.demoTitle")}
            </p>
            <p className="mono-ltr mt-2 text-[11.5px] leading-[1.8] text-muted-foreground">
              {t("auth.demoAccounts")}
            </p>
            <p className="mt-1 text-[11.5px] text-muted-foreground">
              {t("auth.demoPassword", { password: DEMO_PASSWORD })}
            </p>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2">
            <span className="text-[12px] text-muted-foreground">{t("auth.language")}</span>
            <LanguageToggle />
          </div>
        </div>
      </div>
    </div>
  );
}

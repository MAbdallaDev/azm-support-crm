import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";

import { useRegister } from "@/api/portal";
import { homePathForRole } from "@/api/tokenStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * `/portal/register` — reachable **without** authentication, alongside
 * `/login` and `/portal/login`, outside `ProtectedRoute`'s customer-only
 * subtree.
 *
 * The duplicate-email error message must not confirm that an email is
 * specifically the reason a registration failed — Backend Task 1's
 * `RegisterSerializer` deliberately returns the same generic 400 whichever of
 * "malformed" or "already registered" is true, and translating that generic
 * 400 into "this email is taken" here would rebuild the exact oracle the
 * backend was written to avoid.
 */

const schema = z.object({
  full_name: z.string().min(1),
  email: z.string().min(1).email(),
  password: z.string().min(8),
  phone: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const register = useRegister();

  const {
    register: field,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: "", email: "", password: "", phone: "" },
  });

  const onSubmit = handleSubmit((values) => {
    register.mutate(values, {
      onSuccess: (data) => navigate(homePathForRole(data.user.role), { replace: true }),
    });
  });

  const status = register.error instanceof AxiosError ? register.error.response?.status : undefined;
  const bannerKey =
    register.isError && status !== undefined && status < 500 ? "portal.registerFailed" : "auth.unavailable";

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-2 px-6 py-12">
      <div className="w-full max-w-[420px] rounded-[10px] border border-line bg-background p-7">
        <h1 className="text-[22px] font-bold tracking-[-0.01em]">{t("portal.registerTitle")}</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">{t("portal.registerSubtitle")}</p>

        {register.isError ? (
          <div
            role="alert"
            className="mt-5 rounded-lg border border-priority-urgent/30 bg-priority-urgent-bg px-3 py-2 text-[12.5px] font-medium text-priority-urgent"
          >
            {t(bannerKey)}
          </div>
        ) : null}

        <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
          <div className="space-y-[7px]">
            <Label htmlFor="full_name">{t("portal.fullName")}</Label>
            <Input id="full_name" aria-invalid={!!errors.full_name} {...field("full_name")} />
            {errors.full_name ? <p role="alert" className="text-[11.5px] text-priority-urgent">{t("auth.required")}</p> : null}
          </div>

          <div className="space-y-[7px]">
            <Label htmlFor="email">{t("portal.email")}</Label>
            <Input id="email" type="email" dir="ltr" aria-invalid={!!errors.email} {...field("email")} />
            {errors.email ? <p role="alert" className="text-[11.5px] text-priority-urgent">{t("portal.emailInvalid")}</p> : null}
          </div>

          <div className="space-y-[7px]">
            <Label htmlFor="password">{t("portal.password")}</Label>
            <Input id="password" type="password" dir="ltr" aria-invalid={!!errors.password} {...field("password")} />
            {errors.password ? <p role="alert" className="text-[11.5px] text-priority-urgent">{t("portal.passwordTooShort")}</p> : null}
          </div>

          <div className="space-y-[7px]">
            <Label htmlFor="phone">{t("portal.phoneOptional")}</Label>
            <Input id="phone" dir="ltr" {...field("phone")} />
          </div>

          <Button type="submit" disabled={register.isPending} className="h-[42px] w-full text-sm">
            {register.isPending ? (
              <>
                <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                {t("portal.registering")}
              </>
            ) : (
              t("portal.registerSubmit")
            )}
          </Button>
        </form>

        <p className="mt-5 text-center text-[12px] text-muted-foreground">
          {t("portal.haveAccount")}{" "}
          <Link to="/portal/login" className="font-semibold text-brand hover:text-brand-strong">
            {t("auth.signIn")}
          </Link>
        </p>
      </div>
    </div>
  );
}

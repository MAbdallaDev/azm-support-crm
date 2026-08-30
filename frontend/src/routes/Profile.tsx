import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { useChangePassword, useMe, useUpdateProfile } from "@/api/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/toast";

/**
 * Self-service profile. Not a PDF requirement — "Users and roles" only asks
 * for role management, which Django admin already owns — but an empty page
 * behind the user menu's "Profile" item looks broken to anyone who clicks it,
 * whichever of the four roles they are.
 *
 * Scope is deliberately narrow: view the fields Django admin manages (role,
 * department, branch, tier — read-only here, editable there), and let the
 * user change the two things that are genuinely their own: phone and
 * language preference, plus their password.
 */

const infoSchema = z.object({
  phone: z.string().max(32),
  language: z.enum(["en", "ar"]),
});
type InfoValues = z.infer<typeof infoSchema>;

const passwordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8),
});
type PasswordValues = z.infer<typeof passwordSchema>;

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label className="text-muted-foreground">{label}</Label>
      <p className="mt-1 text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

export default function Profile() {
  const { t } = useTranslation();
  const { data: me, isPending } = useMe();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();

  // `values` is a real react-hook-form option (unlike `defaultValues`, it
  // keeps resyncing the form from server data — useful after a save so the
  // field reflects the confirmed value), but it resyncs on every reference
  // change. An inline `{ phone: me.phone, ... }` literal is a NEW object on
  // every render, so RHF read that as "server data changed" after every
  // keystroke's own re-render and reset the field back before the user could
  // ever finish typing — the field looked frozen. Memoizing on the actual
  // string values, not on `me` itself, keeps the reference stable across
  // keystrokes and only changes it when the server value genuinely does.
  const infoValues = useMemo(
    () => (me ? { phone: me.phone, language: me.language } : undefined),
    // Deliberately depend on the primitive fields, not `me` itself — depending
    // on `me` would recreate this object (and resync the form) on every
    // unrelated field change on the user object, defeating the memo's purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [me?.phone, me?.language],
  );
  const infoForm = useForm<InfoValues>({
    resolver: zodResolver(infoSchema),
    values: infoValues,
  });

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current_password: "", new_password: "" },
  });

  const onSaveInfo = infoForm.handleSubmit((values) => {
    updateProfile.mutate(values, {
      onSuccess: () => toast.success(t("profile.saved")),
      onError: () => toast.error(t("profile.saveFailed")),
    });
  });

  const onChangePassword = passwordForm.handleSubmit((values) => {
    changePassword.mutate(values, {
      onSuccess: () => {
        toast.success(t("profile.passwordSaved"));
        passwordForm.reset();
      },
      onError: () => toast.error(t("profile.passwordFailed")),
    });
  });

  if (isPending || !me) {
    return (
      <div className="max-w-xl space-y-3 p-6">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6 p-6">
      <h1 className="text-[22px] font-bold tracking-[-0.01em]">{t("profile.title")}</h1>

      <section className="rounded-[9px] border border-line bg-background p-5">
        <h2 className="text-sm font-semibold text-muted-foreground">{t("profile.accountInfo")}</h2>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <ReadOnlyField label={t("profile.username")} value={me.username} />
          <ReadOnlyField label={t("profile.email")} value={me.email} />
          <ReadOnlyField label={t("profile.role")} value={t(`roles.${me.role}`)} />
          <ReadOnlyField label={t("profile.tier")} value={t("user.tier", { tier: me.tier })} />
          <ReadOnlyField label={t("profile.department")} value={me.department ?? ""} />
          <ReadOnlyField label={t("profile.branch")} value={me.branch ?? ""} />
        </div>
      </section>

      <form
        onSubmit={onSaveInfo}
        className="rounded-[9px] border border-line bg-background p-5"
        noValidate
      >
        <h2 className="text-sm font-semibold text-muted-foreground">{t("profile.editInfo")}</h2>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="profile-phone">{t("profile.phone")}</Label>
            <Input
              id="profile-phone"
              className="mt-1"
              placeholder={t("profile.phonePlaceholder")}
              {...infoForm.register("phone")}
            />
          </div>
          <div>
            <Label htmlFor="profile-language">{t("common.language")}</Label>
            <select
              id="profile-language"
              className="mt-1 flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              {...infoForm.register("language")}
            >
              <option value="en">{t("common.english")}</option>
              <option value="ar">{t("profile.arabic")}</option>
            </select>
          </div>
        </div>
        <Button type="submit" className="mt-4" disabled={updateProfile.isPending}>
          {t("profile.save")}
        </Button>
      </form>

      <form
        onSubmit={onChangePassword}
        className="rounded-[9px] border border-line bg-background p-5"
        noValidate
      >
        <h2 className="text-sm font-semibold text-muted-foreground">
          {t("profile.changePassword")}
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="profile-current-password">{t("profile.currentPassword")}</Label>
            <Input
              id="profile-current-password"
              type="password"
              className="mt-1"
              {...passwordForm.register("current_password")}
            />
            {passwordForm.formState.errors.current_password ? (
              <p className="mt-1 text-xs text-destructive">
                {passwordForm.formState.errors.current_password.message}
              </p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="profile-new-password">{t("profile.newPassword")}</Label>
            <Input
              id="profile-new-password"
              type="password"
              className="mt-1"
              {...passwordForm.register("new_password")}
            />
            {passwordForm.formState.errors.new_password ? (
              <p className="mt-1 text-xs text-destructive">
                {passwordForm.formState.errors.new_password.message}
              </p>
            ) : null}
          </div>
        </div>
        <Button type="submit" className="mt-4" disabled={changePassword.isPending}>
          {t("profile.changePassword")}
        </Button>
      </form>
    </div>
  );
}

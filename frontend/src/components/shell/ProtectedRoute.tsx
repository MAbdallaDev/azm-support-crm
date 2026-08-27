import { AxiosError } from "axios";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation } from "react-router-dom";

import { useMe } from "@/api/auth";
import { homePathForRole, tokenStore } from "@/api/tokenStore";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * The gate in front of each shell.
 *
 * This is a **role check, not a permission check**: it decides which app shell
 * you see, not what you may do inside it. What an agent can do to a ticket is
 * the API's business — `apps/accounts/permissions.py` and `scoping.py` — and
 * duplicating that here would give us two answers that eventually disagree.
 */

export type Audience = "staff" | "customer";

export type ProtectedRouteProps = {
  /** `staff` is agent-or-above; `customer` is the portal. */
  audience: Audience;
  children: React.ReactNode;
};

const FullScreenSkeleton = ({ label }: { label: string }) => (
  <div className="flex min-h-screen flex-col gap-4 p-6" data-testid="session-skeleton">
    <span className="sr-only" role="status">
      {label}
    </span>
    <Skeleton className="h-14 w-full" />
    <Skeleton className="h-8 w-64" />
    <div className="flex flex-1 gap-4">
      <Skeleton className="h-full min-h-[20rem] w-72" />
      <Skeleton className="h-full min-h-[20rem] flex-1" />
    </div>
  </div>
);

export function ProtectedRoute({ audience, children }: ProtectedRouteProps) {
  const location = useLocation();
  const { t } = useTranslation();
  const { data: me, isPending, isError, error, refetch } = useMe();

  /*
   * The login page for *this* subtree, chosen from the audience rather than
   * from the cached role. A first-time visitor pasting a portal link has no
   * cached role at all, and the cached-role answer would open the agent login
   * in front of a customer. The interceptor still uses the cached role — it
   * runs outside the router and has no subtree to ask.
   */
  const loginPath = audience === "customer" ? "/portal/login" : "/login";

  // 1. No token at all. Straight to the front door that matches the last role
  //    we saw, carrying the attempted path so the login can return the user to
  //    exactly where they were headed.
  if (!tokenStore.hasToken()) {
    return (
      <Navigate to={loginPath} replace state={{ from: location }} />
    );
  }

  // 2. Token present, profile still loading. A skeleton — never a flash of the
  //    login page, which reads as "you were signed out" and is a lie.
  if (isPending) return <FullScreenSkeleton label={t("auth.checking")} />;

  if (isError) {
    const status = error instanceof AxiosError ? error.response?.status : undefined;

    // 3a. 401 means the interceptor already tried to refresh and lost. Over.
    if (status === 401) {
      tokenStore.clear();
      return <Navigate to={loginPath} replace state={{ from: location }} />;
    }

    // 3b. Anything else — a network blip, a 500, the API container restarting
    //     — is transient. Signing the user out over it would destroy an
    //     otherwise valid session because a backend hiccuped for two seconds.
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center"
        data-testid="session-error"
      >
        <p className="max-w-sm text-sm text-muted-foreground">{t("auth.sessionError")}</p>
        <Button onClick={() => void refetch()}>{t("auth.retry")}</Button>
      </div>
    );
  }

  // 4. Resolved, but into the wrong shell. Send them to *their* home, not to
  //    login — they are signed in perfectly well, just in the wrong building.
  const belongs = audience === "customer" ? me.role === "customer" : me.role !== "customer";
  if (!belongs) return <Navigate to={homePathForRole(me.role)} replace />;

  return <>{children}</>;
}

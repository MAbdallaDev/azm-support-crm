import * as React from "react";
import { useRouteError } from "react-router-dom";

import i18n from "@/i18n";
import { Button } from "@/components/ui/button";

/**
 * Criterion 7: "an error boundary that reports rather than blanking the page."
 *
 * Two entry points, one fallback screen:
 *
 * - `RouteErrorBoundary` (this file's default export) is a genuine React error
 *   boundary — `componentDidCatch`/`getDerivedStateFromError` cannot yet be
 *   expressed as a function component. Wrapped around each shell's route
 *   `element` in `main.tsx`, it catches a render error thrown anywhere beneath
 *   it, including inside whatever the active child route (`<Outlet/>`) is
 *   currently rendering — a crash in one ticket, one report chart, or one
 *   portal screen takes down that screen, not the whole tab.
 * - `RouteErrorElement`, wired as `errorElement` on the same two routes, is
 *   what React Router's own error mechanism renders for a **loader/action**
 *   error, or for a render error surfacing before `RouteErrorBoundary` itself
 *   has mounted (the layout route's own first render). `useRouteError()` is a
 *   hook, so this half has to be a function component instead.
 *
 * Both share `ErrorScreen` so the two paths look and log identically —
 * `console.error` at minimum in both, never a swallowed error. A real
 * error-reporting service is Phase 2 (see `docs/SUMMARY.md`).
 */

function ErrorScreen({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-2 p-8 text-center"
      data-testid="route-error-boundary"
    >
      <div className="max-w-md rounded-[10px] border border-line bg-background p-7">
        <h1 className="text-[19px] font-bold">{i18n.t("errorBoundary.title")}</h1>
        <p className="mt-2 text-[13px] text-muted-foreground">{i18n.t("errorBoundary.body")}</p>
        <p className="mono-ltr mt-3 max-w-full overflow-x-auto text-start text-[11px] text-faint">
          {message}
        </p>
        <Button className="mt-5" onClick={() => window.location.reload()}>
          {i18n.t("errorBoundary.reload")}
        </Button>
      </div>
    </div>
  );
}

/** Wired as `errorElement` — reads the error React Router itself caught. */
export function RouteErrorElement() {
  const error = useRouteError();
  React.useEffect(() => {
    console.error("RouteErrorElement caught:", error);
  }, [error]);

  return <ErrorScreen error={error} />;
}

type Props = { children: React.ReactNode };
type State = { error: Error | null };

/** Wrapped around each shell's layout element — catches a render error from
 *  the layout itself or from whichever child route `<Outlet/>` is showing. */
export default class RouteErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Never swallowed silently — a caught-but-unlogged error is strictly
    // worse than the crash it replaces, since it now looks like a bug in the
    // *reporting* rather than in the app.
    console.error("RouteErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.error) return <ErrorScreen error={this.state.error} />;
    return this.props.children;
  }
}

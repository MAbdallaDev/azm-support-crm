import { Search, X } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

/**
 * The chrome's search field. Story 06 shipped it inert and flagged it as this
 * story's job; the list it filters now exists.
 *
 * It writes `q` into the **same URL parameter** the queue's own filters use,
 * so searching from any screen navigates to the queue with that term applied,
 * and the result is a shareable, reloadable link like every other filter.
 *
 * Debounced at 300 ms because the input is controlled locally while the URL is
 * the source of truth: typing "invoice" would otherwise push seven history
 * entries and fire seven queries.
 */

const DEBOUNCE_MS = 300;

export function GlobalSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [search] = useSearchParams();

  const urlQuery = search.get("q") ?? "";
  const [value, setValue] = React.useState(urlQuery);

  const onQueue = location.pathname.startsWith("/app/tickets");

  /*
   * Adopt the URL's value when it changes underneath us — a back-button press,
   * or landing on a link that already carries `q`. Guarded on the *URL*
   * changing rather than on every render, so it cannot fight the user's typing.
   */
  React.useEffect(() => {
    setValue(urlQuery);
  }, [urlQuery]);

  React.useEffect(() => {
    if (value === urlQuery) return;

    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(onQueue ? search : undefined);
      if (value) next.set("q", value);
      else next.delete("q");
      next.delete("page");

      // `replace` while already on the queue: a search is a refinement of the
      // current view, not a place worth a separate back-button stop per
      // keystroke. Navigating *to* the queue from elsewhere is a real move.
      navigate(`/app/tickets?${next.toString()}`, { replace: onQueue });
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [value, urlQuery, onQueue, search, navigate]);

  return (
    <div className="hidden w-[300px] items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 lg:flex">
      <Search aria-hidden className="h-3.5 w-3.5 flex-none text-faint" />
      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t("nav.search")}
        aria-label={t("nav.search")}
        data-testid="global-search"
        className="h-[34px] w-full min-w-0 bg-transparent text-[12.5px] outline-none placeholder:text-faint"
      />
      {value ? (
        <button
          type="button"
          onClick={() => setValue("")}
          title={t("tickets.clearFilters")}
          className="flex-none text-faint hover:text-ink-2"
        >
          <X aria-hidden className="h-3.5 w-3.5" />
          <span className="sr-only">{t("tickets.clearFilters")}</span>
        </button>
      ) : null}
    </div>
  );
}
